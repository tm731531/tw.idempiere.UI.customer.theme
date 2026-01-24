# iDempiere Resource UI

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-3.5-4FC08D?logo=vue.js" alt="Vue.js 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/iDempiere-REST%20API-007396" alt="iDempiere" />
</p>

一套為 **iDempiere ERP** 量身打造的現代化單頁應用程式 (SPA)，專注於 **照護管理** 與 **庫存監控** 兩大核心功能。

---

## ✨ 核心功能

###  每日關懷記錄 (MOM Report)

專為照護產業設計的每日記錄系統，完整追蹤被照護者的生活狀態。

| 功能 | 說明 |
| :--- | :--- |
| **晨昏狀態追蹤** | 記錄夜間活動、睡眠品質、晨間精神狀態 |
| **飲食記錄** | 早餐、午餐、晚餐攝取情況 |
| **活動與外出** | 日間活動、外出情況、陪伴狀態 |
| **生理狀況** | 排泄狀態、沐浴情況、安全事故 |
| **AI 智慧摘要** | 串接 Google Gemini API，自動產生照護報告摘要 |
| **PDF 匯出** | 一鍵匯出精美 PDF 報告並附加至 iDempiere |

---

### � 即時庫存監控 (Stock Page)

即時掌握物資庫存狀態，預防缺貨風險。

| 功能 | 說明 |
| :--- | :--- |
| **分庫顯示** | 依倉庫別顯示各品項現有量 |
| **安全水位警示** | 庫存低於設定水位時自動標記紅色警示 |
| **7日平均消耗** | 自動計算近 7 天的日均消耗量 |
| **智慧排序** | 缺貨品項自動置頂，優先處理 |

---

## 🚀 快速開始

### 環境需求
- **Node.js** 18+ 或 **Bun** 1.0+
- 運行中的 **iDempiere** 伺服器 (含 REST API)

### 安裝與啟動

```bash
# 進入 UI 目錄
cd ui

# 安裝依賴
bun install   # 或 npm install

# 啟動開發伺服器
bun run dev   # 或 npm run dev
```

開發伺服器會在 `http://localhost:5173` 啟動。

---

## ⚙️ 環境設定

在 `ui/.env` 建立環境變數：

```env
VITE_API_BASE_URL=http://your-idempiere-server:8080
```

### AI 摘要功能

在 iDempiere 的 `AD_SysConfig` 表中新增：

| Name            | Value                 |
| :-------------- | :-------------------- |
| `GEMINI_API_KEY` | `YOUR_GEMINI_API_KEY` |

---

## 🔗 API 整合

| 端點 | 用途 |
| :--- | :--- |
| `GET /api/v1/models/Z_momSystem` | 每日關懷記錄 |
| `GET /api/v1/models/M_Product` | 產品主檔 |
| `GET /api/v1/models/M_StorageOnHand` | 即時庫存 |
| `GET /api/v1/models/M_Transaction` | 庫存異動 (計算消耗) |
| `GET /api/v1/models/M_AttributeSetInstance` | ASI 效期資料 (GuaranteeDate) |
| `GET /api/v1/models/M_Replenish` | 安全水位設定 |
| `GET /api/v1/reference/{id}` | 下拉選單項目 |
| `POST /api/v1/models/{table}/{id}/attachments` | 上傳 PDF 附件 |

---

## 🧠 技術亮點

- **Metadata-Driven UI**: 自動從 `AD_Column` 讀取中文欄位標籤
- **Safe ID Extraction**: 統一處理 iDempiere 的 `{ id, identifier }` 回傳格式
- **Consumption Analysis**: 僅計算 `I-` (領用) 和 `C-` (出貨) 作為消耗，排除盤盈與進貨
- **Robust Date Parsing**: 處理多種日期格式 (`YYYY-MM-DD`, `MM/DD/YYYY`)

---

## 📄 License

MIT License

---

<p align="center">
  <sub>Built with 💙 for caregivers and inventory managers</sub>
</p>