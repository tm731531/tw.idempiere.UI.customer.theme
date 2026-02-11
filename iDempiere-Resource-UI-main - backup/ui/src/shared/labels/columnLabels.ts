export const zhTwLabelByColumnName: Record<string, string> = {
  // === Common ===
  Name: '名稱',
  Value: '代碼',
  Description: '說明',
  Help: '說明',
  IsActive: '啟用',
  AD_Language: '語系',

  // === Business Partner (C_BPartner) ===
  C_BP_Group_ID: '業務夥伴群組',
  BPValue: '業務夥伴代碼',
  TaxID: '統一編號',
  C_TaxGroup_ID: '稅別群組',
  IsCustomer: '客戶',
  IsVendor: '供應商',
  IsEmployee: '員工',
  IsSalesRep: '業務員',
  SOCreditStatus: '信用狀態',

  // === Contact (AD_User) ===
  FirstName: '名',
  LastName: '姓',
  EMail: '電子郵件',
  Phone: '電話',
  Phone2: '電話 2',
  Fax: '傳真',
  Mobile: '手機',
  Title: '職稱',
  C_Greeting_ID: '稱謂',

  // === Location (C_BPartner_Location / C_Location) ===
  C_Country_ID: '國家',
  C_Region_ID: '州/省',
  C_City_ID: '城市（代碼）',
  RegionName: '州/省（名稱）',
  City: '城市',
  Postal: '郵遞區號',
  Postal_Add: '郵遞區號（附加）',
  Address1: '地址 1',
  Address2: '地址 2',
  Address3: '地址 3',
  Address4: '地址 4',
  IsBillTo: '帳單地址',
  IsShipTo: '送貨地址',
  IsPayFrom: '付款地址',
  IsRemitTo: '匯款地址',
}

export function getColumnLabel(columnName: string, fallback?: string): string {
  return zhTwLabelByColumnName[columnName] || fallback || columnName
}
