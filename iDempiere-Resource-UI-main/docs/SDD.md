# iDempiere Resource UI - Software Design Document (SDD)

## 1. 專案概述 (Overview)
本專案為 iDempiere 的外掛式單頁應用 (SPA)，旨在提供一個現代化、響應式的介面，用於管理 iDempiere 內的資源調度、訂單處理及健康報表 (Mom Report)。

## 2. 系統架構 (System Architecture)

### 2.1 技術棧 (Tech Stack)
- **前端框架**: Vue 3 (Composition API)
- **建置工具**: Vite
- **樣式系統**: Tailwind CSS + DaisyUI (採用現代化色域 oklch)
- **通訊協定**: REST API (iDempiere bxservice)
- **HTTP Client**: `ky` (具有處理 Token 過期重試的封裝)

### 2.2 目錄結構 (Project Structure)
```
ui/
├── src/
│   ├── app/                # 應用的路由與視圖中心
│   │   ├── routes.ts       # 路由定義
│   │   └── views/          # 各功能主頁面 (如 MomReportPage.vue)
│   ├── features/           # 按業務邏輯劃分的模組
│   │   ├── mom/            # 健康報表模組 (API, 類型定義)
│   │   ├── order/          # 訂單模組
│   │   └── ...
│   ├── shared/             # 共享組件與工具
│   │   └── api/            # HTTP 封裝層 (http.ts)
│   └── components/         # 通用 UI 組件
```

## 3. 核心功能模組 (Feature Modules)

### 3.1 健康報表 (Mom Report)
- **資料獲取**: 透過 `$filter` 查詢 `Z_momSystem` 視圖，支援日期區間過濾。
- **資料視覺化**: 使用內嵌圖表元件顯示活動/精神狀態比例（Pie Charts）。
- **欄位映射**: 支援 iDempiere REST 的 PascalCase 欄位及嵌套的 `identifier` 物件 fallback。

### 3.2 PDF 匯出與掛載流程 (PDF Export Pipeline)
為了解決現代 CSS (oklch) 與舊式 HTML-to-Canvas 工具的相容性問題，系統採用以下流程：
1. **DOM 捕獲**: 使用 `html-to-image` 將指定區域轉為 PNG。
2. **PDF 封裝**: 使用 `jsPDF` 建立橫向 A4 檔案並嵌入圖片。
3. **API 關聯**: 透過 `POST /attachments` 子資源端點，以 JSON/Base64 格式將檔案上傳至 iDempiere 指定紀錄。

## 4. 關鍵技術解決方案 (Key Technical Solutions)

### 4.1 附件上傳彈性方案
鑒於 iDempiere 各版本對 `uploads` 多段式 API 的支援度不一，本系統優先採用 **JSON/Base64 模式**：
- **原因**: 避開 Multipart 解析失敗 (415) 及伺服器端 `uploads` 追蹤表缺失 (500) 的問題。
- **實現**: `POST /api/v1/models/{TableName}/{ID}/attachments`。

### 4.2 樣式相容性
針對 `html2canvas` 無法解析 `oklch()` 導致崩潰的問題，系統全面轉向 `SVG-to-Image` 渲染路徑，確保與 Tailwind 4+ 的樣式完全相容。

## 5. 授權與安全 (Authentication & Security)
- **Token 持久化**: 使用 Bearer Token 存儲於狀態管理中。
- **攔截器**: `apiFetch` 自動注入 Authorization Header，並監控 401 狀態以觸發登出或重定向。

## 6. 部署架構 (Deployment)
- **Docker 化**: 提供整合的 `docker-compose.yml`，包含 Hot-Reload 開發環境。
- **iDempiere 整合**: SPA build 後的靜態資源透過 iDempiere 插件的 `web` 目錄提供服務（路徑通常為 `/emui/`）。
