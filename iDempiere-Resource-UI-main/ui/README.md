## iDempiere Resource UI

診所預約管理系統前端，連接 iDempiere ERP REST API。

### 技術棧

- **Framework**: Vue 3 (Composition API + `<script setup>`)
- **Language**: TypeScript
- **Build**: Vite (base: `/emui/`)
- **UI**: daisyUI (Tailwind CSS)
- **Runtime**: Bun

---

## 快速開始

### 本地開發

```bash
# 安裝依賴
bun install

# 啟動開發伺服器
bun run dev
```

開發伺服器：http://localhost:5173/emui/

### Docker 開發

```bash
# 啟動開發環境
docker compose up -d

# 查看日誌
docker compose logs -f dev-server
```

服務端點：
- **dev-server**: http://localhost:8888/emui/ - 前端開發伺服器
- **opencode-web**: http://localhost:5555 - OpenCode Web UI

### 建置生產版本

```bash
bun run build
```

輸出目錄：`../web-content/`

---

## Source 架構

```
src/
  main.ts                  # 入口：建立 Router / 掛載 App
  app/                     # App shell + routes + pages
    App.vue
    routes.ts
    styles.css
    views/
      LoginPage.vue
      BookingPage.vue
      AdminCalendarPage.vue
      OrderPage.vue
      RequestListView.vue
  features/                # 依功能域分組
    auth/
      api.ts
      store.ts
    resource/
      api.ts
    order/
      api.ts
    request/
      api.ts
  shared/                  # 跨 feature 共用基礎
    api/
      http.ts
```

分層原則：
- **app/**: 路由、頁面、版型、全域樣式
- **features/**: 業務功能（auth、resource、order、request）
- **shared/**: 共用基礎設施（HTTP client、utils）

---

## Vite 設定

### 重點設定

| 設定 | 值 | 說明 |
|------|-----|------|
| `base` | `/emui/` | iDempiere 部署路徑 |
| `build.outDir` | `../web-content` | 輸出到插件 web root |

### Router 設定

- **Vue Router**: `createWebHistory('/emui/')`
- **React Router**: `<BrowserRouter basename="/emui">`

---

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `VITE_API_IP` | iDempiere API 伺服器 IP | `192.168.1.47` |
| `VITE_DEFAULT_USER` | 預設登入帳號 | - |
| `VITE_DEFAULT_PASS` | 預設登入密碼 | - |

---

## Docker Compose 服務

```yaml
services:
  dev-server:      # 前端開發伺服器 (port 8888)
    restart: on-failure

  opencode-web:    # OpenCode Web UI (port 5555)
    restart: on-failure
```

兩個服務皆設定 `restart: on-failure`，當程序異常退出時自動重啟。

---

## 部署

完成 build 後執行：

```bash
../build-spa.sh
```

將產物打包進 JAR 部署到 iDempiere。

### Router（如果有）

- **Vue Router**：`createWebHistory('/emui/')`
- **React Router**：`<BrowserRouter basename="/emui">`
