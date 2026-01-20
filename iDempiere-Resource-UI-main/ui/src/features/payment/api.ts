import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export interface Payment {
  id: number
  documentNo: string
  bpartnerId: number
  bpartnerName: string
  bankAccountId: number
  bankAccountNo: string
  bankName: string
  dateTrx: string
  payAmt: number
  tenderType: string
  docStatus: string
}

export interface Request {
  id: number
  name: string
  description: string
  bpartnerId: number
  bpartnerName: string
  salesRepId?: number
  salesRepName?: string
  requestTypeId?: number
  requestTypeName?: string
  requestStatusId?: number
  requestStatusName?: string
  startDate?: string
  closeDate?: string
  created: string
  lastContactDate?: string // 最後聯繫日期
  daysSinceLastContact?: number // 未聯繫天數
  priorityLevel?: 'HIGH' | 'MEDIUM' | 'LOW' // 優先級
  nextFollowUpDate?: string // 下次聯絡日期
  taskStatus?: string // 任務狀態
  assignedConsultant?: number // 分配的諮詢師
}

export interface BankAccount {
  id: number
  accountNo: string
  bankId: number
  bankName: string
  currencyId?: number
}

export interface TenderType {
  code: string
  name: string
}

export const TENDER_TYPES: TenderType[] = [
  { code: 'X', name: '現金' },
  { code: 'K', name: '信用卡' },
  { code: 'A', name: '轉帳' },
  { code: 'D', name: '匯款' },
  { code: 'M', name: '線上支付' },
]

export async function listPayments(
  token: string,
  options: {
    filter?: string
    tenderType?: string
    docStatus?: string
    dateFrom?: string
    dateTo?: string
    top?: number
    skip?: number
  } = {},
): Promise<{ records: Payment[], totalCount: number }> {
  const searchParams: Record<string, string | number> = {
    $select: 'C_Payment_ID,DocumentNo,C_BPartner_ID,DateTrx,PayAmt,TenderType,DocStatus,C_BankAccount_ID',
    $orderby: 'DateTrx desc,DocumentNo desc',
    $filter: 'IsReceipt eq true',
  }

  // Add filters
  if (options.tenderType) {
    searchParams.$filter += ` and TenderType eq '${options.tenderType}'`
  }
  if (options.docStatus) {
    searchParams.$filter += ` and DocStatus eq '${options.docStatus}'`
  }
  if (options.dateFrom) {
    searchParams.$filter += ` and DateTrx ge '${options.dateFrom}'`
  }
  if (options.dateTo) {
    searchParams.$filter += ` and DateTrx le '${options.dateTo}'`
  }
  if (options.filter) {
    searchParams.$filter += ` and (${options.filter})`
  }

  if (options.top)
    searchParams.$top = options.top
  if (options.skip)
    searchParams.$skip = options.skip

  // Fetch payments
  const res = await apiFetch<{ 'records': any[], 'row-count'?: number }>(`${API_V1}/models/C_Payment`, {
    token,
    searchParams,
  })

  // Build bank account lookup map to help resolve AccountNo when the nested field isn't returned
  let bankAccountNoLookup: Map<number, string> = new Map()
  try {
    const accounts = await listBankAccounts(token)
    bankAccountNoLookup = new Map(accounts.map(a => [a.id, a.accountNo]))
  }
  catch {
    // ignore lookup failures; fall back to blank values
  }

  const records = (res.records ?? []).map(r => ({
    id: Number(r.id),
    documentNo: String(r.DocumentNo ?? ''),
    bpartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
    bpartnerName: String(r.C_BPartner_ID?.identifier ?? r.C_BPartner_ID?.name ?? ''),
    bankAccountId: Number(r.C_BankAccount_ID?.id ?? r.C_BankAccount_ID ?? 0),
    bankAccountNo: String(r.C_BankAccount_ID?.AccountNo ?? bankAccountNoLookup.get(Number(r.C_BankAccount_ID?.id ?? r.C_BankAccount_ID ?? 0)) ?? ''),
    bankName: String(r.C_BankAccount_ID?.identifier ?? r.C_BankAccount_ID?.name ?? ''),
    dateTrx: String(r.DateTrx ?? ''),
    payAmt: Number(r.PayAmt ?? 0),
    tenderType: String(r.TenderType?.id ?? r.TenderType ?? ''),
    docStatus: String(r.DocStatus?.id ?? r.DocStatus ?? ''),
  }))

  return {
    records,
    totalCount: res['row-count'] ?? res.records?.length ?? 0,
  }
}

export async function getPayment(token: string, id: number): Promise<Payment> {
  const res = await apiFetch<any>(`${API_V1}/models/C_Payment/${id}`, { token })
  return {
    id: Number(res.id),
    documentNo: String(res.DocumentNo ?? ''),
    bpartnerId: Number(res.C_BPartner_ID?.id ?? res.C_BPartner_ID ?? 0),
    bpartnerName: String(res.C_BPartner_ID?.identifier ?? res.C_BPartner_ID?.name ?? ''),
    bankAccountId: Number(res.C_BankAccount_ID?.id ?? res.C_BankAccount_ID ?? 0),
    bankAccountNo: String(res.C_BankAccount_ID?.AccountNo ?? ''),
    bankName: String(res.C_BankAccount_ID?.identifier ?? res.C_BankAccount_ID?.name ?? ''),
    dateTrx: String(res.DateTrx ?? ''),
    payAmt: Number(res.PayAmt ?? 0),
    tenderType: String(res.TenderType?.id ?? res.TenderType ?? ''),
    docStatus: String(res.DocStatus?.id ?? res.DocStatus ?? ''),
  }
}

export async function listBankAccounts(token: string): Promise<BankAccount[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_BankAccount`, {
    token,
    searchParams: {
      $select: 'C_BankAccount_ID,AccountNo,C_Bank_ID,C_Currency_ID',
      $orderby: 'AccountNo',
    },
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    accountNo: String(r.AccountNo ?? ''),
    bankId: Number(r.C_Bank_ID?.id ?? r.C_Bank_ID ?? 0),
    bankName: String(r.C_Bank_ID?.identifier ?? r.C_Bank_ID?.name ?? ''),
    currencyId: r.C_Currency_ID?.id ? Number(r.C_Currency_ID.id) : (r.C_Currency_ID ? Number(r.C_Currency_ID) : undefined),
  }))
}

/**
 * 获取银行账户的货币 ID
 */
async function getBankAccountCurrency(token: string, bankAccountId: number): Promise<number | null> {
  try {
    const res = await apiFetch<any>(`${API_V1}/models/C_BankAccount/${bankAccountId}`, {
      token,
      searchParams: {
        $select: 'C_Currency_ID',
      },
    })

    const currencyId = res.C_Currency_ID?.id ? Number(res.C_Currency_ID.id) : (res.C_Currency_ID ? Number(res.C_Currency_ID) : null)
    return currencyId
  }
  catch (error) {
    console.warn('Failed to get currency from bank account:', error)
    return null
  }
}

/**
 * 获取系统默认货币 ID（通常是 USD = 100）
 */
async function getDefaultCurrency(token: string): Promise<number> {
  try {
    // 尝试获取系统默认货币（通常是 USD，ID = 100）
    const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Currency`, {
      token,
      searchParams: {
        $select: 'C_Currency_ID',
        $filter: 'ISO_Code eq \'USD\'',
        $top: 1,
      },
    })

    if (res.records && res.records.length > 0) {
      return Number(res.records[0].id)
    }

    // 如果没有找到 USD，尝试获取第一个活跃的货币
    const allRes = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Currency`, {
      token,
      searchParams: {
        $select: 'C_Currency_ID',
        $filter: 'IsActive eq true',
        $top: 1,
        $orderby: 'C_Currency_ID',
      },
    })

    if (allRes.records && allRes.records.length > 0) {
      return Number(allRes.records[0].id)
    }

    // 最后的默认值：100 (通常是 USD)
    return 100
  }
  catch (error) {
    console.warn('Failed to get default currency, using fallback:', error)
    // 默认返回 100 (通常是 USD)
    return 100
  }
}

export async function createPayment(
  token: string,
  payment: {
    bpartnerId: number
    bankAccountId: number
    dateTrx: string
    payAmt: number
    tenderType: string
    description?: string
  },
): Promise<any> {
  // Convert date string to full ISO timestamp
  let dateTrxISO: string
  try {
    const date = new Date(`${payment.dateTrx}T00:00:00`)
    if (Number.isNaN(date.getTime())) {
      throw new TypeError('Invalid date format')
    }
    dateTrxISO = date.toISOString()
  }
  catch {
    throw new Error('Invalid DateTrx format. Expected YYYY-MM-DD format.')
  }

  // Get currency ID from bank account, or use default
  let currencyId: number
  try {
    const bankCurrencyId = await getBankAccountCurrency(token, payment.bankAccountId)
    if (bankCurrencyId && bankCurrencyId > 0) {
      currencyId = bankCurrencyId
    }
    else {
      currencyId = await getDefaultCurrency(token)
    }
  }
  catch (error) {
    console.warn('Failed to get currency, using default:', error)
    currencyId = await getDefaultCurrency(token)
  }

  const paymentData = {
    C_BPartner_ID: payment.bpartnerId,
    C_BankAccount_ID: payment.bankAccountId,
    C_Currency_ID: currencyId,
    DateTrx: dateTrxISO,
    PayAmt: payment.payAmt,
    TenderType: payment.tenderType,
    Description: payment.description || null,
    IsReceipt: true,
    DocStatus: 'DR',
  }

  // Debug: Log the payment data being sent
  console.log('Creating C_Payment with payload:', JSON.stringify(paymentData, null, 2))

  return await apiFetch<any>(`${API_V1}/models/C_Payment`, {
    method: 'POST',
    token,
    json: paymentData,
  })
}

export async function updatePayment(
  token: string,
  id: number,
  payment: {
    payAmt?: number
    tenderType?: string
    description?: string
  },
): Promise<any> {
  const json: Record<string, any> = {}
  if (payment.payAmt !== undefined)
    json.PayAmt = payment.payAmt
  if (payment.tenderType !== undefined)
    json.TenderType = payment.tenderType
  if (payment.description !== undefined)
    json.Description = payment.description

  return await apiFetch<any>(`${API_V1}/models/C_Payment/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

export async function updatePaymentStatus(
  token: string,
  id: number,
  docAction: 'CO' | 'VO' | 'RE', // Complete, Void, Reverse
  description?: string,
): Promise<any> {
  const json: Record<string, any> = { DocAction: docAction }
  if (description)
    json.Description = description

  return await apiFetch<any>(`${API_V1}/models/C_Payment/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

export async function deletePayment(token: string, id: number): Promise<void> {
  await apiFetch<any>(`${API_V1}/models/C_Payment/${id}`, {
    method: 'DELETE',
    token,
  })
}

export async function updateRequestContactInfo(
  token: string,
  id: number,
  data: {
    lastContactDate?: string
    daysSinceLastContact?: number
    nextFollowUpDate?: string
  },
): Promise<any> {
  const json: Record<string, any> = {}
  if (data.lastContactDate !== undefined)
    json.lastContactDate = data.lastContactDate
  if (data.daysSinceLastContact !== undefined)
    json.daysSinceLastContact = data.daysSinceLastContact
  if (data.nextFollowUpDate !== undefined)
    json.nextFollowUpDate = data.nextFollowUpDate

  return await apiFetch<any>(`${API_V1}/models/R_Request/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

export async function updateRequestStatus(
  token: string,
  id: number,
  data: {
    taskStatus?: string
    priorityLevel?: 'HIGH' | 'MEDIUM' | 'LOW'
    nextFollowUpDate?: string
    assignedConsultant?: number
  },
): Promise<any> {
  const json: Record<string, any> = {}
  if (data.taskStatus !== undefined)
    json.R_Status_ID = getTaskStatusId(data.taskStatus)
  if (data.priorityLevel !== undefined)
    json.Priority = data.priorityLevel
  if (data.nextFollowUpDate !== undefined)
    json.NextFollowUpDate = data.nextFollowUpDate
  if (data.assignedConsultant !== undefined)
    json.SalesRep_ID = data.assignedConsultant

  return await apiFetch<any>(`${API_V1}/models/R_Request/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

// Helper function to get status ID from status name
function getTaskStatusId(statusName: string): string {
  const statusMap: Record<string, string> = {
    NEW: '1000001',
    IN_PROGRESS: '1000002',
    COMPLETED: '1000003',
    CANCELLED: '1000004',
  }
  return statusMap[statusName] || '1000001'
}

// Helper function to get priority ID from priority name
function _getPriorityId(priorityName: string): string {
  const priorityMap: Record<string, string> = {
    HIGH: '1000001',
    MEDIUM: '1000002',
    LOW: '1000003',
  }
  return priorityMap[priorityName] || '1000003'
}

export async function getCustomerBalance(
  token: string,
  bpartnerId: number,
): Promise<{
  totalOutstanding: number
  creditLimit: number
  availableCredit: number
}> {
  try {
    // Get customer info for credit limit first (most reliable)
    const bpRes = await apiFetch<any>(`${API_V1}/models/C_BPartner/${bpartnerId}`, {
      token,
      searchParams: {
        $select: 'SO_CreditLimit',
      },
    })

    const creditLimit = Number(bpRes.SO_CreditLimit || 0)

    // Try to get outstanding invoices with error handling
    let totalOutstanding = 0

    try {
      // Use a simple approach that avoids potentially non-existent fields
      const invoiceRes = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Invoice`, {
        token,
        searchParams: {
          $select: 'GrandTotal',
          $filter: `C_BPartner_ID eq ${bpartnerId} and IsSOTrx eq true`,
          $top: 50, // Limit to recent invoices
        },
      })

      if (invoiceRes.records && invoiceRes.records.length > 0) {
        totalOutstanding = invoiceRes.records.reduce((sum: number, inv: any) =>
          sum + Number(inv.GrandTotal || 0), 0)
      }
    }
    catch (invoiceError) {
      console.warn('Invoice data unavailable, using simple credit limit only:', invoiceError)
      totalOutstanding = 0
    }

    const availableCredit = creditLimit - totalOutstanding

    return {
      totalOutstanding,
      creditLimit,
      availableCredit,
    }
  }
  catch (error) {
    console.error('Failed to get customer balance:', error)
    // Return safe defaults
    return {
      totalOutstanding: 0,
      creditLimit: 0,
      availableCredit: 0,
    }
  }
}
