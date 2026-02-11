# 諮詢單動態欄位功能

## 功能概述
諮詢單現在使用動態欄位系統，類似於 bpartner 的實現方式，支援：
- 從資料庫動態載入所有欄位
- 管理員可配置哪些欄位預設隱藏
- 支援多種欄位類型（文字、數字、日期、下拉選單等）

## 使用方式

### 1. 欄位配置模式（需要管理員權限）
1. 在諮詢單新增對話框中，如果使用者有管理員權限，會看到「欄位配置模式」選項
2. 勾選後會顯示所有欄位，每個欄位旁有「隱藏」核取方塊
3. 可以選擇要隱藏的欄位
4. 點擊「儲存配置」後，這些欄位將對所有使用者隱藏

### 2. 欄位配置儲存位置
- 欄位配置儲存在 `AD_SysConfig` 表中
- 配置名稱格式：`EMUI_FV_request-consultation_request`
- 值為 JSON 格式：`{"hiddenFields": ["FieldName1", "FieldName2"]}`

### 3. 預設顯示的欄位
系統會自動顯示以下欄位（如果存在）：
- `C_BPartner_ID` - 客戶（必填）
- `Summary` - 諮詢單名稱（必填）
- `Result` - 說明
- `SalesRep_ID` - 負責諮詢師
- `R_RequestType_ID` - Request Type
- `R_Status_ID` - Status
- `StartDate` - 諮詢開始時間
- `CloseDate` - 諮詢結束時間

### 4. 自動排除的欄位
系統會自動隱藏以下類型的欄位：
- 系統欄位（AD_Client_ID, Created, CreatedBy, Updated, UpdatedBy, IsActive）
- 主鍵欄位（IsKey = true）
- 父關聯欄位（IsParent = true）
- UU 欄位（以 _UU 結尾）
- 按鈕類型欄位（ReferenceType = Button）
- 未顯示欄位（IsDisplayed = false 或 SeqNo = 0）

## 技術實現

### 1. 動態欄位載入
```typescript
// 使用自定義的 window API 載入 R_Request 欄位
const fields = await getRequestTabFields(token, language)
```

### 2. 欄位可見性控制
```typescript
// 管理員配置的隱藏欄位
const adminHiddenFields = await getFieldVisibility(token, 'request-consultation', 'request')

// 最終顯示的欄位 = 所有欄位 - 系統排除 - 管理員隱藏
const visibleFields = fields.filter(f => 
  !shouldExcludeField(f) && 
  !adminHiddenFields.includes(f.columnName)
)
```

### 3. 動態表單提交
```typescript
// 支援任意欄位組合的提交
await createRequestFromDynamicForm(token, formData)
```

## 注意事項
1. 欄位配置需要系統管理員權限
2. 配置更改會立即生效
3. 如果某欄位被隱藏但為必填，表單提交會失敗並提示缺少必填欄位
4. 所有欄位都支援國際化（中文/英文）