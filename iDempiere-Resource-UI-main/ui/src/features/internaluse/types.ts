/**
 * Internal Use 掃描領用系統 - 型別定義
 */

/** 費用科目 */
export interface Charge {
  id: number        // C_Charge_ID
  name: string      // C_Charge.Name
}

/** 領用清單項目 */
export interface InternalUseItem {
  productId: number       // M_Product_ID
  productValue: string    // M_Product.Value
  productName: string     // M_Product.Name
  uomName: string         // C_UOM.Name
  qty: number             // 領用數量（正數）
}

/** 內部領用單資料 */
export interface InternalUseData {
  warehouseId: number     // M_Warehouse_ID
  chargeId: number        // C_Charge_ID
  orgId?: number          // AD_Org_ID
  movementDate?: string   // 異動日期 (YYYY-MM-DD)，預設今天
  description?: string    // 備註說明
  items: InternalUseItem[]
}

/** 建立結果 */
export interface CreateInventoryResult {
  id: number              // M_Inventory_ID
  documentNo: string      // 單號
}

/** 庫位資料 */
export interface Locator {
  id: number              // M_Locator_ID
  value: string           // M_Locator.Value
  warehouseId: number     // M_Warehouse_ID
}
