# Claude 快速上手指南

> 此文件幫助 Claude 快速理解專案，減少 token 消耗。
> 最後更新：2026-01-14

## 一句話概述

**診所預約管理系統前端**，連接 iDempiere ERP REST API，Vue 3 + TypeScript + daisyUI。

---

## 技術棧速查

```
Framework: Vue 3 (Composition API + <script setup>)
Language:  TypeScript
Build:     Vite (base: /emui/)
UI:        daisyUI (Tailwind CSS)
State:     useAuth() composable (localStorage)
API:       apiFetch() 封裝 (shared/api/http.ts)
```

---

## 目錄結構（只看重點）

```
ui/src/
├── app/views/
│   ├── LoginPage.vue          # 登入（兩步驟：帳密 → Tenant/Role/Org）
│   ├── BookingPage.vue        # 用戶預約頁 ⭐ 核心功能
│   └── AdminCalendarPage.vue  # 管理員行事曆
├── features/
│   ├── auth/api.ts            # 登入 API
│   ├── auth/store.ts          # useAuth() token 管理
│   └── resource/api.ts        # 預約 CRUD ⭐
└── shared/api/http.ts         # apiFetch 封裝

ui/
├── TODO.md                    # 開發進度追蹤 ⭐ 必看
├── CLAUDE.md                  # 本文件
└── .env                       # VITE_API_IP
```

---

## API 端點速查

```typescript
// 認證
POST /api/v1/auth/tokens              // 登入
PUT  /api/v1/auth/tokens              // 設定 client/role/org

// 資源預約（核心）
GET    /api/v1/models/S_Resource
GET    /api/v1/models/S_ResourceType/{id}
GET    /api/v1/models/S_ResourceAssignment?$filter=...
POST   /api/v1/models/S_ResourceAssignment
PUT    /api/v1/models/S_ResourceAssignment/{id}
DELETE /api/v1/models/S_ResourceAssignment/{id}

// 顏色標籤（存 AD_SysConfig）
Name: EMUI_RESOURCE_ASSIGNMENT_COLOR_{assignmentId}
```

---

## 已完成功能 ✅

### 登入
- 兩步驟登入流程
- Token 持久化 localStorage

### 預約頁 (`BookingPage.vue`) - 70%
- 週行事曆（Google Calendar 風格）
- 多資源疊加顯示
- **直接點日曆新增預約**（不需按鈕）
- Hover 顯示時長（綠色 overlay + 分鐘 badge）
- 過去時段 disabled（斜線 + cursor: not-allowed）
- 點擊預約可編輯（名稱/顏色/刪除）
- 營業日/時段過濾

---

## 程式碼模式

### API 呼叫
```typescript
import { apiFetch } from '../../shared/api/http'

// GET
const res = await apiFetch<{ records: any[] }>(
  `/api/v1/models/TABLE`,
  { token, searchParams: { $filter: `Field eq ${val}` } }
)

// POST/PUT
await apiFetch(`/api/v1/models/TABLE/${id}`, {
  method: 'PUT',
  token,
  json: { Field: value }
})
```

### 行事曆計算
```typescript
const HOUR_HEIGHT = 60 // 每小時 60px
// 時間→位置: top = (minutes / 60) * HOUR_HEIGHT
// 位置→時間: minutes = (y / HOUR_HEIGHT) * 60
```

---

## 待開發（依優先順序）

1. **權限系統** - System/User 區分、選單權限
2. **業務夥伴 C_BPartner** - 客戶/員工/供應商
3. **諮詢單 R_Request** - 待接應、甘特圖
4. **銷售訂單 C_Order** - 開單
5. **療程單 M_Production** - 訂單轉療程

**詳見 `TODO.md`**

---

## 注意事項

1. **Base URL**: `/emui/`
2. **API Proxy**: dev 時 `/api` → `http://{VITE_API_IP}:8080`
3. **顏色存儲**: 在 `AD_SysConfig`，非 Assignment 本身
4. **時間格式**: ISO `yyyy-MM-dd'T'HH:mm:ss'Z'`

---

## 開發指令

```bash
cd ui
bun run dev    # http://localhost:5173/emui/
bun run build  # 輸出 ../web-content/
bun run lint   # ESLint 檢查
bunx vue-tsc --noEmit  # TypeScript 類型檢查
```

**注意**: 本專案使用 **bun** 而非 npm

---

## 快速定位

| 需求 | 檔案 |
|------|------|
| 登入 | `features/auth/api.ts` |
| 預約 CRUD | `features/resource/api.ts` |
| 預約 UI | `app/views/BookingPage.vue` |
| 進度追蹤 | `TODO.md` |

---

## iDempiere API 陷阱

```
✅ 列表用 GET /api/v1/models/{Table}
✅ 新增用 POST /api/v1/windows/{slug} (觸發商業邏輯)
✅ 更新用 PUT /api/v1/models/{Table}/{id}
❌ 不要用 /windows/{slug}/tabs/{tab} 查列表（會 404）
```

---

## 最近變更 (2026-01-14)

- 新增預約編輯功能（點擊修改）
- 直接點日曆預約（移除按鈕依賴）
- 過去時段 disabled 樣式
- Hover 時長預覽
- 建立 TODO.md 進度追蹤
