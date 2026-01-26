/**
 * QR Code 採購系統 - 型別定義
 */

/** QR Code 內容格式 */
export interface QRCodeData {
  product: string  // M_Product.Value
}

/** 產品資訊 */
export interface Product {
  id: number              // M_Product_ID
  value: string           // M_Product.Value (編碼)
  name: string            // M_Product.Name (名稱)
  uomId: number           // C_UOM_ID
  uomName?: string        // C_UOM.Name (單位名稱)
}

/** 掃描清單項目 */
export interface PurchaseItem {
  productId: number       // M_Product_ID
  productValue: string    // M_Product.Value
  productName: string     // M_Product.Name
  uomId: number           // C_UOM_ID
  uomName: string         // C_UOM.Name
  qty: number             // 數量，預設 1
  price: number           // 單價，預設 1
}

/** 採購單資料 */
export interface PurchaseOrderData {
  vendorId: number        // C_BPartner_ID
  warehouseId: number     // M_Warehouse_ID
  orgId?: number          // AD_Org_ID (Optional, inferred from warehouse if possible)
  dateOrdered?: string    // 採購日期 (YYYY-MM-DD)，預設今天
  items: PurchaseItem[]   // 採購項目
}

/** 供應商資料 */
export interface Vendor {
  id: number              // C_BPartner_ID
  value: string           // C_BPartner.Value
  name: string            // C_BPartner.Name
}

/** 新增供應商請求 */
export interface CreateVendorRequest {
  name: string            // 供應商名稱
  value?: string          // 編碼，可選（自動產生）
}

/** 倉庫資料 */
export interface Warehouse {
  id: number              // M_Warehouse_ID
  name: string            // M_Warehouse.Name
  orgId: number           // AD_Org_ID
}

/** 採購單建立結果 */
export interface CreateOrderResult {
  id: number              // C_Order_ID
  documentNo: string      // 單號
}
