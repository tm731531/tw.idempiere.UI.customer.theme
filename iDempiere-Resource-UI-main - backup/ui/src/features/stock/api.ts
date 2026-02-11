import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export interface ProductStock {
    productId: number
    productValue: string
    productName: string
    warehouseStocks: {
        warehouseId: number
        warehouseName: string
        qtyOnHand: number
        safetyStock: number
        isBelowSafety: boolean
    }[]
    totalQty: number
    totalSafetyStock: number
    isBelowSafety: boolean
    avgConsumption7d: number
    // Expiry tracking
    nearestExpiryDate?: string
    isExpiringSoon: boolean  // Within 2 days
    isExpired: boolean
}

export async function listProductStock(token: string): Promise<ProductStock[]> {
    console.log('[Stock] Fetching inventory and consumption data...');

    // 1. Fetch Products
    let products: any[] = []
    try {
        const res = await apiFetch<any>(`${API_V1}/models/M_Product`, {
            token,
            searchParams: { $select: 'Value,Name', $top: 1000 }
        })
        products = res.records || []
    } catch (e) {
        console.error('[Stock] Failed to fetch products:', e)
        return []
    }

    // 2. Fetch Storage
    let storage: any[] = []
    try {
        const res = await apiFetch<any>(`${API_V1}/models/M_StorageOnHand`, {
            token,
            searchParams: { $filter: "QtyOnHand gt 0" }
        })
        storage = res.records || []
    } catch (e) {
        console.warn('[Stock] M_StorageOnHand failed, trying M_Storage...')
        try {
            const res = await apiFetch<any>(`${API_V1}/models/M_Storage`, {
                token,
                searchParams: { $filter: "QtyOnHand gt 0" }
            })
            storage = res.records || []
        } catch (e2) {
            console.error('[Stock] Storage fetch failed')
        }
    }

    // 3. Metadata (Locators & Warehouses)
    const locMap = new Map<number, number>()
    const whMap = new Map<number, string>()

    try {
        const locRes = await apiFetch<any>(`${API_V1}/models/M_Locator`, { token })
        locRes.records?.forEach((r: any) => {
            const lid = r.id || r.M_Locator_ID?.id
            const wid = r.M_Warehouse_ID?.id || r.M_Warehouse_ID
            if (lid && wid) locMap.set(Number(lid), Number(wid))
        })

        const whRes = await apiFetch<any>(`${API_V1}/models/M_Warehouse`, { token, searchParams: { $select: 'Name' } })
        whRes.records?.forEach((r: any) => {
            const wid = r.id || r.M_Warehouse_ID?.id
            if (wid) whMap.set(Number(wid), r.Name)
        })
    } catch (e) { console.warn('[Stock] Metadata fetch (Locator/WH) failed') }

    // 4. Fetch Replenishment (Safety Stock)
    const replenishRules: any[] = []
    try {
        const res = await apiFetch<any>(`${API_V1}/models/M_Replenish`, {
            token,
            searchParams: { $select: 'M_Product_ID,M_Warehouse_ID,Level_Min' }
        })
        replenishRules.push(...(res.records || []))
    } catch (e) { console.warn('[Stock] Replenishment fetch failed') }

    // 5. Fetch ASI (Attribute Set Instance) for Expiry Dates
    const asiMap = new Map<number, Date>() // ASI ID -> GuaranteeDate
    try {
        // Get unique ASI IDs from storage
        const asiIds = new Set<number>()
        storage.forEach(s => {
            const asiId = s.M_AttributeSetInstance_ID?.id || s.M_AttributeSetInstance_ID
            if (asiId && asiId !== 0) asiIds.add(Number(asiId))
        })

        if (asiIds.size > 0) {
            // Fetch ASI records with GuaranteeDate
            const asiRes = await apiFetch<any>(`${API_V1}/models/M_AttributeSetInstance`, {
                token,
                searchParams: { $select: 'GuaranteeDate', $top: 2000 }
            })
            asiRes.records?.forEach((r: any) => {
                const id = r.id || r.M_AttributeSetInstance_ID
                const gDate = r.GuaranteeDate?.id || r.GuaranteeDate
                if (id && gDate) {
                    const dateStr = String(gDate)
                    let parsedDate: Date
                    if (dateStr.includes('-')) {
                        parsedDate = new Date(dateStr.replace(' ', 'T'))
                    } else {
                        parsedDate = new Date(dateStr)
                    }
                    if (!isNaN(parsedDate.getTime())) {
                        asiMap.set(Number(id), parsedDate)
                    }
                }
            })
            console.log(`[Stock] Fetched ${asiMap.size} ASI records with expiry dates.`)
        }
    } catch (e) { console.warn('[Stock] ASI fetch failed', e) }

    // 5. Fetch Transactions for 7-day average
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const dateStr = sevenDaysAgo.toISOString().split('T')[0] // YYYY-MM-DD

    const transactions: any[] = []
    try {
        // Query M_Transaction for negative movements (consumption)
        const res = await apiFetch<any>(`${API_V1}/models/M_Transaction`, {
            token,
            searchParams: {
                // Fetch more records without strict filters to ensure we don't miss recent data
                $select: 'M_Product_ID,MovementDate,MovementQty,MovementType',
                $orderby: 'MovementDate desc, Created desc',
                $top: 2000
            }
        })
        transactions.push(...(res.records || []))
        console.log(`[Stock] Fetched ${res.records?.length || 0} transactions. Reference Date (7d ago): ${sevenDaysAgo.toISOString()}`);
    } catch (e) { console.warn('[Stock] Consumption fetch failed', e) }

    // 6. Merge
    const result: ProductStock[] = products.map(p => {
        const pId = Number(p.id)

        const pStorage = storage.filter(s => {
            const spId = s.M_Product_ID?.id || s.M_Product_ID
            return Number(spId) === pId
        })

        const whSum = new Map<number, number>()
        pStorage.forEach(s => {
            const lId = s.M_Locator_ID?.id || s.M_Locator_ID
            const wId = lId ? locMap.get(Number(lId)) : null
            const finalWhId = wId || 999
            whSum.set(finalWhId, (whSum.get(finalWhId) || 0) + Number(s.QtyOnHand || 0))
        })

        // Consumption calculation
        const pTrans = transactions.filter(t => {
            const spId = t.M_Product_ID?.id || t.M_Product_ID
            return Number(spId) === pId
        })
        const dailyConsumptionMap = new Map<string, number>()
        pTrans.forEach(t => {
            // 1. Robust Date Parsing
            const rawDate = t.MovementDate?.id || t.MovementDate || ''
            const dateStrRaw = String(rawDate)

            let tDate: Date;
            if (dateStrRaw.includes('-')) {
                // Handle ISO YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
                tDate = new Date(dateStrRaw.replace(' ', 'T'));
            } else {
                // Handle other formats like MM/DD/YYYY
                tDate = new Date(dateStrRaw);
            }

            if (isNaN(tDate.getTime())) return;
            if (tDate < sevenDaysAgo) return;

            const dateOnly = tDate.toISOString().split('T')[0];

            // 2. Net Consumption Calculation
            // We want to count actual usage. In iDempiere:
            // I- = Inventory Use, C- = Customer Shipment
            const mType = String(t.MovementType?.id || t.MovementType);
            const qtyField = t.MovementQty?.id !== undefined ? t.MovementQty.id : t.MovementQty;
            const qtyRaw = Number(qtyField || 0);

            // ONLY count standard consumption types: Inventory Use (I-) and Customer Shipments (C-)
            if (!['I-', 'C-'].includes(mType)) return;
            if (qtyRaw >= 0) return; // Consumption must be a decrease

            const qty = -qtyRaw;
            dailyConsumptionMap.set(dateOnly, (dailyConsumptionMap.get(dateOnly) || 0) + qty)
        })

        const daysWithData = dailyConsumptionMap.size
        const totalConsumed = Array.from(dailyConsumptionMap.values()).reduce((sum, q) => sum + q, 0)
        // Average: total / actual days (but at most 7 or at least 1)
        const avgConsumption7d = daysWithData > 0 ? (totalConsumed / daysWithData) : 0

        if (totalConsumed > 0) {
            console.log(`[Calc] Product: ${p.Value}, Total: ${totalConsumed}, Days: ${daysWithData}, Avg: ${avgConsumption7d}`);
        }

        const relevantWhIds = new Set(whSum.keys())
        replenishRules.forEach(r => {
            const rpId = r.M_Product_ID?.id || r.M_Product_ID
            const rwId = r.M_Warehouse_ID?.id || r.M_Warehouse_ID
            if (Number(rpId) === pId && rwId) relevantWhIds.add(Number(rwId))
        })

        const warehouseStocks = Array.from(relevantWhIds).map(whId => {
            const qty = whSum.get(whId) || 0
            const rule = replenishRules.find(r => {
                const rpId = r.M_Product_ID?.id || r.M_Product_ID
                const rwId = r.M_Warehouse_ID?.id || r.M_Warehouse_ID
                return Number(rpId) === pId && Number(rwId) === whId
            })
            const safetyStock = Number(rule?.Level_Min || 0)
            return {
                warehouseId: whId,
                warehouseName: whMap.get(whId) || (whId === 999 ? '未知庫位' : `倉庫 #${whId}`),
                qtyOnHand: qty,
                safetyStock,
                isBelowSafety: (safetyStock > 0) && (qty < safetyStock)
            }
        })

        const totalQty = warehouseStocks.reduce((sum, s) => sum + s.qtyOnHand, 0)
        const totalSafetyStock = warehouseStocks.reduce((sum, s) => sum + s.safetyStock, 0)

        // Expiry calculation: find nearest expiry date for this product
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const twoDaysFromNow = new Date(today)
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        // Find nearest expiry from all storage records of this product
        const expiryDates: Date[] = []
        pStorage.forEach(s => {
            const asiId = s.M_AttributeSetInstance_ID?.id || s.M_AttributeSetInstance_ID
            if (asiId && asiMap.has(Number(asiId))) {
                expiryDates.push(asiMap.get(Number(asiId))!)
            }
        })

        let nearestExpiryDate: string | undefined = undefined
        let isExpired = false
        let isExpiringSoon = false

        if (expiryDates.length > 0) {
            expiryDates.sort((a, b) => a.getTime() - b.getTime())
            const nearestExpiry = expiryDates[0]
            nearestExpiryDate = nearestExpiry.toISOString().split('T')[0]
            isExpired = nearestExpiry < today
            isExpiringSoon = nearestExpiry >= today && nearestExpiry <= twoDaysFromNow
        }

        return {
            productId: pId,
            productValue: p.Value,
            productName: p.Name,
            warehouseStocks,
            totalQty,
            totalSafetyStock,
            isBelowSafety: (totalSafetyStock > 0) && (totalQty < totalSafetyStock),
            avgConsumption7d,
            nearestExpiryDate,
            isExpiringSoon,
            isExpired
        }
    })

    // Filter to only products that have stock or a safety stock rule or consumption
    return result.filter(r => r.totalQty > 0 || r.totalSafetyStock > 0 || r.avgConsumption7d > 0)
}
