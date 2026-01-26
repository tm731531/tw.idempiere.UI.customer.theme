/**
 * 權限系統類型定義
 */

// 使用者類型：System 可管理權限，User 為一般用戶
export type UserType = 'System' | 'User'

// 選單項目定義
export interface MenuItem {
  id: string // 唯一識別碼 (A, B, C, ...)
  name: string // 顯示名稱
  tableName: string // 主要資料表
  path: string // 路由路徑
  icon?: string // 圖示（可選）
  description?: string // 說明
}

// 選單權限設定（存在 AD_SysConfig）
export interface MenuPermission {
  menuId: string // MenuItem.id
  userId: number // AD_User_ID
  enabled: boolean // 是否啟用
}

// 欄位可見性設定
export interface FieldVisibility {
  tableName: string // 資料表名稱
  fieldName: string // 欄位名稱
  visible: boolean // 是否可見
  clientId: number // AD_Client_ID
  orgId: number // AD_Org_ID
}

// 固定選單清單（寫死）
export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'A',
    name: '業務夥伴',
    tableName: 'C_BPartner',
    path: '/bpartner',
    description: '建立客戶、員工、供應商主檔',
  },
  {
    id: 'B',
    name: '諮詢單',
    tableName: 'R_Request',
    path: '/request',
    description: '諮詢師接應客戶使用',
  },
  {
    id: 'C',
    name: '預約單',
    tableName: 'S_ResourceAssignment',
    path: '/book',
    description: '預約諮詢室、醫師與手術室',
  },
  {
    id: 'D',
    name: '銷售訂單',
    tableName: 'C_Order',
    path: '/sales-order',
    description: '客戶確認下單',
  },
  {
    id: 'E',
    name: '療程單',
    tableName: 'M_Production',
    path: '/production',
    description: '銷售訂單轉療程',
  },
  {
    id: 'F',
    name: '付款單',
    tableName: 'C_Payment',
    path: '/payment',
    description: '收取客戶款項',
  },
  {
    id: 'G',
    name: '採購訂單',
    tableName: 'C_Order',
    path: '/purchase-order',
    description: '建立耗品採購',
  },
  {
    id: 'H',
    name: '收貨單',
    tableName: 'M_InOut',
    path: '/receipt',
    description: '收貨操作',
  },
  {
    id: 'I',
    name: '報表',
    tableName: '',
    path: '/report',
    description: '期末庫存、總客戶數、今日收款等',
  },
  {
    id: 'J',
    name: 'Mom 報表',
    tableName: 'Z_momSystem',
    path: '/mom-report',
    description: '檢視 Mom 系統每日健康報告與統計',
  },
  {
    id: 'K',
    name: '耗材庫存',
    tableName: 'M_Product',
    path: '/inventory',
    description: '監控失智照顧耗材與安全庫存',
  },
  {
    id: 'L',
    name: '掃描採購',
    tableName: 'C_Order',
    path: '/scan-purchase',
    description: '掃描 QR Code 快速建立採購單',
  },
  {
    id: 'M',
    name: 'QR產生器',
    tableName: 'M_Product',
    path: '/qr-generator',
    description: '產生產品 QR Code 供掃描採購使用',
  },
  {
    id: 'N',
    name: '掃描領用',
    tableName: 'M_Inventory',
    path: '/scan-internal-use',
    description: '掃描 QR Code 快速建立內部領用單',
  },
]

// System 專用選單
export const SYSTEM_MENU_ITEMS: MenuItem[] = [
  {
    id: 'SYS_PERMISSION',
    name: '權限管理',
    tableName: '',
    path: '/admin/permissions',
    description: '管理選單權限與欄位可見性',
  },
  {
    id: 'SYS_CALENDAR',
    name: '管理行事曆',
    tableName: 'S_ResourceAssignment',
    path: '/admin/calendar',
    description: '管理員行事曆檢視',
  },
]
