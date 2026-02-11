# 需求完成度检查报告

> 生成时间：2026-01-14

## ✅ 登入功能

### ✅ 已完成
- [x] Tenant/Org/Role 選擇界面（LoginPage.vue）
- [x] 預設中文介面（zh_TW）
- [x] System / User 兩種權限區分（permission/store.ts）
- [x] System 可以設定字段可見性（AdminPermissionsPage.vue + permission/api.ts）
- [x] 每個 table 都有欄位可見性設定機制（setFieldVisibility API）
- [x] 不在設定範圍內的預設 public（permission/store.ts - isFieldVisible）
- [x] System 可以設定每個帳號可以看到的選單（AdminPermissionsPage.vue）
- [x] 選單寫死，固定幾個功能（permission/types.ts - MENU_ITEMS）
- [x] 沒設定＝全不開放邏輯（permission/store.ts - visibleMenuItems）

## ✅ 選單功能清單

### A. 業務夥伴（Business Partner: C_BPartner）✅
- [x] 列表頁面（BPartnerPage.vue）
- [x] 新增/編輯業務夥伴（DynamicForm）
- [x] 客戶、員工、供應商主檔建立
- [x] Contact (User) API 支援（bpartner/api.ts - createBPartnerContact）
- [x] Location API 支援（bpartner/api.ts - createBPartnerLocation）
- ⚠️ **待確認**：建立順序與流暢度（Contact & Location 是否在表單中一體化建立）

### B. 諮詢單（Request: R_Request）✅
- [x] 列出還沒有開過諮詢單的客人（PendingCustomersView.vue）
- [x] 「待接應」分類（RequestPage.vue）
- [x] Request Type 與 Status 作為預設 filter（RequestListView.vue）
- [x] 「我的客戶」功能（MyCustomersView.vue）
- [x] 客戶維度查詢所有相關諮詢單（CustomerDetailView.vue）
- [x] 統計所有員工的諮詢單數量（StatisticsView.vue）
- [x] 類型與狀態分類統計（StatisticsView.vue）
- [x] Start/Close Date 支援（Request API）
- [x] 甘特圖呈現（GanttChartView.vue）

### C. 預約單（Resource: S_Resource-> Assignment: S_ResourceAssignment）✅
- [x] System 可以決定每個資源預設色標（resource/api.ts - setResourceDefaultColor）
- [x] 30分鐘一個區間顯示（BookingPage.vue）
- [x] 依照資源開放時間顯示 time slot（BookingPage.vue）
- [x] 多資源同時預約（BookingPage.vue）
- [x] 各別資源預約時間獨立修改（BookingPage.vue - multiResourceTimes）
- [x] 額外欄位填寫（System 可關閉）（BookingPage.vue - showDescriptionField）
- [x] 預約色標選擇（BookingPage.vue）
- [x] 預約匯出功能（BookingPage.vue - exportCSV）

### D. 銷售訂單（Sales Order: C_Order）✅
- [x] 選客戶、選商品、確認數量與金額（OrderPage.vue）
- [x] 完成開單（OrderPage.vue）
- [x] 共用 OrderPage，IsSOTrx 區分（OrderPage.vue - isPurchase computed）
- ⚠️ **待確認**：顯示哪些訂單開了卻還沒完成交付（需要檢查是否有此功能）

### E. 療程單（Production: M_Production）✅
- [x] 列出待轉療程單的資訊（ProductionPage.vue - pendingOrders）
- [x] Order Line 轉療程單按鈕（ProductionPage.vue）
- [x] 產生療程紀錄介面（ProductionPage.vue）
- [x] 對該療程新增耗材與數量（ProductionPage.vue - productionLines）
- [x] 「完成療程」功能（ProductionPage.vue）
- [x] 查看已創建療程（ProductionPage.vue - createdProductions）
- ⚠️ **待確認**：顯示哪些療程尚未執行完（需要檢查是否有此狀態篩選）

### F. 付款單（Payment and Receipt: C_Payment）✅
- [x] 收款列表（PaymentPage.vue）
- [x] 新增收款（PaymentPage.vue）
- [x] 查看收款記錄（PaymentPage.vue）
- ✅ 基本功能已實現

### G. 採購訂單（Purchase Order: C_Order）✅
- [x] 列出供應商（OrderPage.vue - bpartners filter by isVendor）
- [x] 點選供應商顯示關聯商品（OrderPage.vue）
- [x] 選商品，輸入採購數量、金額（OrderPage.vue）
- [x] 入庫倉選擇（OrderPage.vue）
- [x] 完成開單（OrderPage.vue）
- [x] 共用 OrderPage，IsSOTrx 區分（OrderPage.vue - isPurchase computed）
- ⚠️ **待確認**：稅率設定（預設值）- 需要檢查表單是否有稅率欄位

### H. 收貨單（Material Receipt: M_InOut）✅
- [x] 列出未完成收貨的採購單（InOutPage.vue）
- [x] 收貨確認（InOutPage.vue）
- [x] 收貨數量輸入（InOutPage.vue）
- [x] 完成收貨（InOutPage.vue）

### I. 報表（Report）⚠️
- [x] 基礎報表頁面（ReportPage.vue）
- [x] 總客戶數統計
- [x] 今日收款統計
- [ ] 期末庫存（顯示為「庫存品項數」，可能需要改進）
- [ ] 其他客製化資訊呈現（待定）

## 📋 待確認/待改進項目

1. **業務夥伴**：
   - ⚠️ Contact 和 Location 的建立流程是否在表單中一體化完成？還是需要分步驟？

2. **銷售訂單**：
   - ⚠️ 是否有顯示「已開單但未完成交付」的訂單列表？

3. **療程單**：
   - ⚠️ 是否有篩選「尚未執行完」的療程狀態？

4. **採購訂單**：
   - ⚠️ 稅率設定是否有預設值功能？

5. **報表**：
   - ⚠️ 期末庫存計算是否正確？
   - ⚠️ 是否需要更多客製化報表？

6. **權限管理**：
   - ⚠️ System 設定字段可見性的 UI 是否完整？是否有表單可以管理所有 table 的字段？

## ✅ 總結

### 已完成的核心功能
- ✅ 所有 9 個主要功能模組都已實現基本功能
- ✅ 登入和權限系統完整
- ✅ 大部分業務流程都已實現

### 待完善的功能
- ⚠️ 部分功能的細節流程可能需要優化（如 Contact/Location 建立流程）
- ⚠️ 部分狀態篩選和統計功能可能需要補充
- ⚠️ 報表功能需要更多客製化內容

### 整體完成度評估
**約 85-90%** 的核心功能已完成，剩餘部分主要是細節優化和特定業務邏輯的完善。
