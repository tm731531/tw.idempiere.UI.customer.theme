# iDempiere Resource UI 設計規格書

> **版本**: 1.0
> **最後更新**: 2025-01
> **目的**: 本規格書完整描述 iDempiere Resource UI 專案的架構、功能與實作細節，使開發者能依據本文件重新建構整個系統。

---

## 目錄

1. [專案概述](#1-專案概述)
2. [技術棧](#2-技術棧)
3. [專案結構](#3-專案結構)
4. [前端架構](#4-前端架構)
5. [後端架構](#5-後端架構)
6. [核心功能模組](#6-核心功能模組)
7. [頁面元件規格](#7-頁面元件規格)
8. [共用元件規格](#8-共用元件規格)
9. [Composables 規格](#9-composables-規格)
10. [API 整合規格](#10-api-整合規格)
11. [狀態管理](#11-狀態管理)
12. [路由與權限](#12-路由與權限)
13. [樣式系統](#13-樣式系統)
14. [部署與建置](#14-部署與建置)
15. [資料結構定義](#15-資料結構定義)

---

## 1. 專案概述

### 1.1 專案目標

iDempiere Resource UI 是一套為 **iDempiere ERP** 量身打造的現代化單頁應用程式 (SPA)，專注於以下兩大核心功能：

1. **每日關懷記錄 (MOM Report)** - 照護產業的每日記錄系統
2. **即時庫存監控 (Stock Page)** - 物資庫存狀態監控

### 1.2 核心特性

| 特性 | 說明 |
|------|------|
| **Metadata-Driven UI** | 自動從 iDempiere `AD_Column` 讀取欄位標籤與配置 |
| **AI 智慧摘要** | 整合 Google Gemini API 自動產生照護報告摘要 |
| **PDF 匯出** | 一鍵匯出精美 PDF 報告並附加至 iDempiere |
| **即時庫存警示** | 庫存低於安全水位時自動標記警示 |
| **權限控管** | 基於角色的功能存取控制 |

### 1.3 目標用戶

- 照護機構管理人員
- 庫存管理人員
- 系統管理員

---

## 2. 技術棧

### 2.1 前端技術

| 技術 | 版本 | 用途 |
|------|------|------|
| Vue.js | 3.5.13 | 響應式 UI 框架 |
| TypeScript | 5.7.2 | 類型安全 |
| Vue Router | 4.4.5 | 客戶端路由 |
| TailwindCSS | 3.4.17 | 功能型 CSS 框架 |
| DaisyUI | 4.x | UI 組件庫 |
| Vite | 6.1.0 | 建置工具 |
| ky | 1.14.2 | HTTP 客戶端 |
| html2pdf.js | 0.14.0 | PDF 生成 |
| html-to-image | 1.11.13 | HTML 轉圖片 |
| @google/generative-ai | 0.24.1 | Gemini AI 整合 |
| @headlessui/vue | 1.7.23 | 無頭 UI 組件 |

### 2.2 後端技術

| 技術 | 版本 | 用途 |
|------|------|------|
| Java | 17+ | 後端語言 |
| Servlet API | 4.0 | Web 容器 |
| iDempiere REST API | - | 資料存取層 |

### 2.3 開發工具

| 工具 | 用途 |
|------|------|
| Bun / npm | 套件管理 |
| Docker | 開發環境容器化 |
| ESLint | 程式碼檢查 |

---

## 3. 專案結構

```
iDempiere-Resource-UI-main/
├── ui/                              # 前端 SPA 應用
│   ├── src/
│   │   ├── main.ts                  # 應用程式入口
│   │   ├── vite-env.d.ts            # Vite 類型定義
│   │   ├── app/                     # 應用殼層
│   │   │   ├── App.vue              # 根組件
│   │   │   ├── routes.ts            # 路由定義
│   │   │   ├── styles.css           # 全域樣式
│   │   │   └── views/               # 頁面組件
│   │   │       ├── LoginPage.vue
│   │   │       ├── MomReportPage.vue
│   │   │       ├── StockPage.vue
│   │   │       ├── BookingPage.vue
│   │   │       ├── BPartnerPage.vue
│   │   │       ├── OrderPage.vue
│   │   │       ├── PaymentPage.vue
│   │   │       ├── InOutPage.vue
│   │   │       ├── ProductionPage.vue
│   │   │       ├── RequestPage.vue
│   │   │       ├── ReportPage.vue
│   │   │       ├── AdminCalendarPage.vue
│   │   │       ├── AdminPermissionsPage.vue
│   │   │       └── ...
│   │   ├── components/              # 共用組件
│   │   │   ├── DynamicForm.vue
│   │   │   ├── DynamicField.vue
│   │   │   ├── ErrorMessage.vue
│   │   │   ├── SuccessMessage.vue
│   │   │   ├── StatusBadge.vue
│   │   │   └── Pagination.vue
│   │   ├── composables/             # Vue Composables
│   │   │   ├── useForm.ts
│   │   │   └── useList.ts
│   │   ├── features/                # 功能模組
│   │   │   ├── auth/
│   │   │   │   ├── api.ts
│   │   │   │   ├── store.ts
│   │   │   │   └── types.ts
│   │   │   ├── permission/
│   │   │   │   ├── api.ts
│   │   │   │   ├── store.ts
│   │   │   │   └── types.ts
│   │   │   ├── window/
│   │   │   │   ├── api.ts
│   │   │   │   └── types.ts
│   │   │   ├── mom/
│   │   │   │   ├── api.ts
│   │   │   │   └── types.ts
│   │   │   ├── stock/
│   │   │   │   ├── api.ts
│   │   │   │   └── types.ts
│   │   │   └── ...
│   │   └── shared/                  # 共用工具
│   │       ├── api/
│   │       │   └── http.ts
│   │       ├── utils/
│   │       │   ├── format.ts
│   │       │   ├── datetime.ts
│   │       │   └── error.ts
│   │       └── labels/
│   │           └── columnLabels.ts
│   ├── index.html                   # HTML 入口
│   ├── package.json                 # 依賴定義
│   ├── vite.config.ts               # Vite 配置
│   ├── tsconfig.json                # TypeScript 配置
│   ├── tailwind.config.js           # TailwindCSS 配置
│   └── postcss.config.js            # PostCSS 配置
├── src/                             # Java 後端
│   └── tw/mxp/emui/
│       ├── SpaFilter.java           # SPA 路由過濾器
│       └── SpaServlet.java          # 靜態資源服務
├── web-content/                     # 建置輸出目錄
├── WEB-INF/
│   └── web.xml                      # Servlet 配置
├── META-INF/
│   └── MANIFEST.MF                  # JAR 清單
├── lib/                             # Java 依賴
├── Dockerfile                       # Docker 配置
├── docker-compose.yml               # Docker Compose
├── build-spa.sh                     # 建置腳本 (Unix)
├── build-spa.bat                    # 建置腳本 (Windows)
└── README.md                        # 專案說明
```

---

## 4. 前端架構

### 4.1 應用程式入口 (main.ts)

```typescript
// 初始化流程
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './app/App.vue'
import { routes } from './app/routes'
import { useAuth } from './features/auth/store'
import { usePermission } from './features/permission/store'
import { setTokenExpiredHandler } from './shared/api/http'

// 1. 創建 Vue 應用
const app = createApp(App)

// 2. 載入已持久化的認證會話
const auth = useAuth()
auth.load()

// 3. 若已登入，載入權限配置
const permission = usePermission()
if (auth.isAuthenticated.value) {
  permission.loadPermissions(
    auth.token.value!,
    auth.roleId.value!,
    auth.userId.value!,
    auth.clientId.value!,
    auth.organizationId.value!
  )
}

// 4. 創建路由器
const router = createRouter({
  history: createWebHistory('/emui/'),
  routes,
})

// 5. 路由守衛
router.beforeEach((to) => {
  const publicRoutes = new Set(['/login'])

  if (publicRoutes.has(to.path)) return true
  if (!auth.isAuthenticated.value) return { path: '/login' }

  if (!permission.permissionsLoaded.value) return true
  if (!permission.canAccessPath(to.path)) {
    const firstMenu = permission.visibleMenuItems.value[0]
    return firstMenu ? { path: firstMenu.path } : { path: '/login' }
  }

  return true
})

// 6. Token 過期處理
setTokenExpiredHandler(() => {
  auth.clear()
  router.push('/login')
})

// 7. 掛載應用
app.use(router)
app.mount('#app')
```

### 4.2 根組件 (App.vue)

```vue
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../features/auth/store'
import { usePermission } from '../features/permission/store'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const permission = usePermission()

// 計算屬性
const showNavbar = computed(() =>
  auth.isAuthenticated.value && route.path !== '/login'
)

const menuItems = computed(() => permission.visibleMenuItems.value)

// 登出處理
async function handleLogout() {
  auth.clear()
  permission.resetPermissions()
  await router.push('/login')
}
</script>

<template>
  <!-- 導航欄 -->
  <nav v-if="showNavbar" class="navbar bg-base-100 shadow-lg">
    <div class="flex-1">
      <span class="text-xl font-bold">iDempiere Resource UI</span>
    </div>
    <div class="flex-none">
      <!-- 動態菜單 -->
      <ul class="menu menu-horizontal">
        <li v-for="item in menuItems" :key="item.id">
          <router-link :to="item.path">{{ item.name }}</router-link>
        </li>
      </ul>
      <!-- 用戶資訊 -->
      <div class="dropdown dropdown-end">
        <span>{{ auth.userName.value }}</span>
        <button @click="handleLogout">登出</button>
      </div>
    </div>
  </nav>

  <!-- 路由視圖 -->
  <main class="container mx-auto p-4">
    <RouterView />
  </main>
</template>
```

### 4.3 Vite 配置 (vite.config.ts)

```typescript
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiIP = env.VITE_API_IP || '127.0.0.1'

  return {
    base: '/emui/',
    plugins: [vue()],
    server: {
      proxy: {
        '/api': {
          target: `http://${apiIP}:8080`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: '../web-content',
      assetsDir: 'assets',
      emptyOutDir: true,
    },
  }
})
```

### 4.4 TypeScript 配置 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "jsx": "preserve"
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["node_modules"]
}
```

---

## 5. 後端架構

### 5.1 SPA 過濾器 (SpaFilter.java)

```java
package tw.mxp.emui;

import javax.servlet.*;
import javax.servlet.http.*;
import java.io.IOException;

/**
 * SPA 路由過濾器
 * 將所有非資源請求轉發到 index.html
 */
public class SpaFilter implements Filter {

    private ServletContext context;

    @Override
    public void init(FilterConfig config) {
        this.context = config.getServletContext();
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res,
                         FilterChain chain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        String path = buildPath(request);

        // 1. 根路徑讓容器處理
        if ("/".equals(path)) {
            chain.doFilter(req, res);
            return;
        }

        // 2. 資源存在則直接轉發
        if (resourceExists(path)) {
            chain.doFilter(req, res);
            return;
        }

        // 3. 資產路徑（有副檔名）返回 404
        if (isAssetPath(path)) {
            ((HttpServletResponse) res).sendError(404);
            return;
        }

        // 4. 客戶端路由轉發到 index.html
        request.getRequestDispatcher("/index.html").forward(req, res);
    }

    private String buildPath(HttpServletRequest request) {
        String contextPath = request.getContextPath();
        String requestURI = request.getRequestURI();
        return requestURI.substring(contextPath.length());
    }

    private boolean resourceExists(String path) {
        try {
            return context.getResource(path) != null;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isAssetPath(String path) {
        int lastDot = path.lastIndexOf('.');
        int lastSlash = path.lastIndexOf('/');
        return lastDot > lastSlash;
    }

    @Override
    public void destroy() {}
}
```

### 5.2 SPA Servlet (SpaServlet.java)

```java
package tw.mxp.emui;

import javax.servlet.*;
import javax.servlet.http.*;
import java.io.*;
import java.net.URL;

/**
 * 靜態資源服務 Servlet
 */
public class SpaServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String path = req.getPathInfo();

        // 目錄請求加上 index.html
        if (path == null || path.endsWith("/")) {
            path = (path == null ? "" : path) + "index.html";
        }

        URL resource = getServletContext().getResource(path);

        if (resource == null) {
            // 嘗試作為 SPA 路由處理
            resource = getServletContext().getResource("/index.html");
            if (resource == null) {
                resp.sendError(500, "index.html not found");
                return;
            }
        }

        // 設置 MIME 類型
        String mimeType = getServletContext().getMimeType(path);
        if (mimeType != null) {
            resp.setContentType(mimeType);
        }

        // 流式傳輸
        try (InputStream in = resource.openStream();
             OutputStream out = resp.getOutputStream()) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
        }
    }
}
```

### 5.3 Web 配置 (web.xml)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         version="4.0">

    <display-name>iDempiere Resource UI</display-name>

    <!-- SPA Filter -->
    <filter>
        <filter-name>SpaFilter</filter-name>
        <filter-class>tw.mxp.emui.SpaFilter</filter-class>
    </filter>
    <filter-mapping>
        <filter-name>SpaFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>

    <!-- SPA Servlet -->
    <servlet>
        <servlet-name>SpaServlet</servlet-name>
        <servlet-class>tw.mxp.emui.SpaServlet</servlet-class>
    </servlet>
    <servlet-mapping>
        <servlet-name>SpaServlet</servlet-name>
        <url-pattern>/</url-pattern>
    </servlet-mapping>

    <!-- Welcome File -->
    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
    </welcome-file-list>

</web-app>
```

---

## 6. 核心功能模組

### 6.1 認證模組 (features/auth/)

#### types.ts
```typescript
export interface AuthRequest {
  userName: string
  password: string
}

export interface AuthResponse {
  token: string
  userId: number
}

export interface Client {
  id: number
  name: string
}

export interface Role {
  id: number
  name: string
}

export interface Organization {
  id: number
  name: string
}

export interface Warehouse {
  id: number
  name: string
}

export interface Session {
  token: string
  userId: number
  userName?: string
  clientId: number
  clientName?: string
  roleId: number
  roleName?: string
  organizationId: number
  organizationName?: string
  warehouseId?: number
  language?: string
}
```

#### api.ts
```typescript
import { apiFetch } from '../../shared/api/http'
import type { AuthRequest, AuthResponse, Client, Role, Organization, Warehouse } from './types'

const API_V1 = '/api/v1'

export async function login(request: AuthRequest): Promise<AuthResponse> {
  return apiFetch(`${API_V1}/auth/tokens`, {
    method: 'POST',
    json: request,
  })
}

export async function setLoginParameters(
  params: {
    clientId: number
    roleId: number
    organizationId: number
    warehouseId?: number
    language?: string
  },
  token: string
): Promise<void> {
  await apiFetch(`${API_V1}/auth/tokens`, {
    method: 'PUT',
    token,
    json: params,
  })
}

export async function getClients(token: string): Promise<Client[]> {
  const res = await apiFetch<{ clients: Client[] }>(`${API_V1}/auth/clients`, { token })
  return res.clients
}

export async function getRoles(clientId: number, token: string): Promise<Role[]> {
  const res = await apiFetch<{ roles: Role[] }>(`${API_V1}/auth/roles`, {
    token,
    searchParams: { clientId },
  })
  return res.roles
}

export async function getOrganizations(
  clientId: number,
  roleId: number,
  token: string
): Promise<Organization[]> {
  const res = await apiFetch<{ organizations: Organization[] }>(
    `${API_V1}/auth/organizations`,
    {
      token,
      searchParams: { clientId, roleId },
    }
  )
  return res.organizations
}

export async function getWarehouses(
  clientId: number,
  roleId: number,
  organizationId: number,
  token: string
): Promise<Warehouse[]> {
  const res = await apiFetch<{ warehouses: Warehouse[] }>(
    `${API_V1}/auth/warehouses`,
    {
      token,
      searchParams: { clientId, roleId, organizationId },
    }
  )
  return res.warehouses
}

export async function getClientLanguage(
  clientId: number,
  token: string
): Promise<string> {
  const res = await apiFetch<{ language: string }>(`${API_V1}/auth/language`, {
    token,
    searchParams: { clientId },
  })
  return res.language
}
```

#### store.ts
```typescript
import { ref, computed } from 'vue'
import type { Session } from './types'

const STORAGE_KEY = 'idempiere.resource.session.v1'

const session = ref<Session | null>(null)

export function useAuth() {
  const isAuthenticated = computed(() => !!session.value?.token)
  const token = computed(() => session.value?.token ?? null)
  const userId = computed(() => session.value?.userId ?? null)
  const userName = computed(() => session.value?.userName ?? null)
  const clientId = computed(() => session.value?.clientId ?? null)
  const clientName = computed(() => session.value?.clientName ?? null)
  const roleId = computed(() => session.value?.roleId ?? null)
  const roleName = computed(() => session.value?.roleName ?? null)
  const organizationId = computed(() => session.value?.organizationId ?? null)
  const language = computed(() => session.value?.language ?? 'zh_TW')

  function load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        session.value = JSON.parse(stored)
      }
    } catch {
      session.value = null
    }
  }

  function set(newSession: Session): void {
    session.value = newSession
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession))
  }

  function clear(): void {
    session.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    isAuthenticated,
    token,
    userId,
    userName,
    clientId,
    clientName,
    roleId,
    roleName,
    organizationId,
    language,
    load,
    set,
    clear,
  }
}
```

### 6.2 權限模組 (features/permission/)

#### types.ts
```typescript
export type UserType = 'System' | 'User'

export interface MenuItem {
  id: string
  name: string
  path: string
  requiresSystem?: boolean
}

export const MENU_ITEMS: MenuItem[] = [
  { id: 'J', name: 'Mom 報表', path: '/mom-report' },
  { id: 'K', name: '耗材庫存', path: '/inventory' },
]

export const SYSTEM_MENU_ITEMS: MenuItem[] = [
  { id: 'SYS_ADMIN_CALENDAR', name: '日曆管理', path: '/admin/calendar', requiresSystem: true },
  { id: 'SYS_ADMIN_PERMISSIONS', name: '權限管理', path: '/admin/permissions', requiresSystem: true },
]
```

#### store.ts
```typescript
import { ref, computed } from 'vue'
import { getUserType, getUserMenuPermissions } from './api'
import { MENU_ITEMS, SYSTEM_MENU_ITEMS, type UserType, type MenuItem } from './types'

const userType = ref<UserType>('User')
const enabledMenuIds = ref<Set<string>>(new Set())
const permissionsLoaded = ref(false)

export function usePermission() {
  const isSystem = computed(() => userType.value === 'System')

  const visibleMenuItems = computed<MenuItem[]>(() => {
    if (isSystem.value) {
      return [...MENU_ITEMS, ...SYSTEM_MENU_ITEMS]
    }
    return MENU_ITEMS.filter(item => enabledMenuIds.value.has(item.id))
  })

  function canAccessMenu(menuId: string): boolean {
    if (isSystem.value) return true
    return enabledMenuIds.value.has(menuId)
  }

  function canAccessPath(path: string): boolean {
    const allItems = [...MENU_ITEMS, ...SYSTEM_MENU_ITEMS]
    const item = allItems.find(m => m.path === path)
    if (!item) return true // 未定義的路徑預設允許
    if (item.requiresSystem && !isSystem.value) return false
    return canAccessMenu(item.id)
  }

  async function loadPermissions(
    token: string,
    roleId: number,
    userId: number,
    clientId: number,
    orgId: number
  ): Promise<void> {
    try {
      // 判斷用戶類型
      userType.value = await getUserType(token, roleId)

      if (userType.value !== 'System') {
        // 載入用戶菜單權限
        const permissions = await getUserMenuPermissions(token, userId)
        enabledMenuIds.value = new Set(permissions)
      }

      permissionsLoaded.value = true
    } catch (error) {
      console.error('Failed to load permissions:', error)
      permissionsLoaded.value = true
    }
  }

  function resetPermissions(): void {
    userType.value = 'User'
    enabledMenuIds.value = new Set()
    permissionsLoaded.value = false
  }

  return {
    userType,
    isSystem,
    visibleMenuItems,
    permissionsLoaded,
    canAccessMenu,
    canAccessPath,
    loadPermissions,
    resetPermissions,
  }
}
```

### 6.3 通用視窗模組 (features/window/)

#### types.ts
```typescript
export const ReferenceType = {
  String: 10,
  Integer: 11,
  Amount: 12,
  Text: 14,
  Date: 15,
  DateTime: 16,
  List: 17,
  Table: 18,
  TableDirect: 19,
  YesNo: 20,
  Number: 22,
  Button: 28,
  Search: 30,
  Memo: 34,
  ChosenMultipleSelectionList: 200161,
} as const

export interface TabField {
  columnName: string
  name: string
  description?: string
  help?: string
  referenceId: number
  referenceValueId?: number
  tableName?: string
  keyColumnName?: string
  displayColumnName?: string
  isMandatory: boolean
  isReadOnly: boolean
  isDisplayed: boolean
  isKey: boolean
  isParent: boolean
  fieldLength?: number
  defaultValue?: string
  seqNo: number
}

export interface LookupOption {
  id: number
  identifier: string
}
```

#### api.ts
```typescript
import { apiFetch } from '../../shared/api/http'
import type { TabField, LookupOption } from './types'

const API_V1 = '/api/v1'

export async function getTabFields(
  token: string,
  windowSlug: string,
  tabSlug: string
): Promise<TabField[]> {
  const res = await apiFetch<{ fields: TabField[] }>(
    `${API_V1}/windows/${windowSlug}/tabs/${tabSlug}/fields`,
    { token }
  )
  return res.fields
}

export async function getReferenceLookupOptions(
  token: string,
  referenceValueId: number
): Promise<LookupOption[]> {
  const res = await apiFetch<{ records: LookupOption[] }>(
    `${API_V1}/reference/${referenceValueId}`,
    { token }
  )
  return res.records
}

export async function getTableLookupOptions(
  token: string,
  tableName: string,
  params?: {
    filter?: string
    select?: string
    top?: number
  }
): Promise<LookupOption[]> {
  const res = await apiFetch<{ records: Array<{ id: number; [key: string]: unknown }> }>(
    `${API_V1}/models/${tableName}`,
    {
      token,
      searchParams: {
        $top: params?.top ?? 100,
        $filter: params?.filter,
        $select: params?.select,
      },
    }
  )

  return res.records.map(r => ({
    id: r.id,
    identifier: String(r.Name ?? r.Value ?? r.id),
  }))
}

export async function getWindowRecord<T>(
  token: string,
  windowSlug: string,
  tabSlug: string,
  recordId: number
): Promise<T> {
  return apiFetch(`${API_V1}/models/${tabSlug}/${recordId}`, { token })
}

export async function createWindowRecord<T>(
  token: string,
  windowSlug: string,
  tabSlug: string,
  data: Partial<T>
): Promise<T> {
  return apiFetch(`${API_V1}/models/${tabSlug}`, {
    method: 'POST',
    token,
    json: data,
  })
}

export async function updateWindowRecord<T>(
  token: string,
  windowSlug: string,
  tabSlug: string,
  recordId: number,
  data: Partial<T>
): Promise<T> {
  return apiFetch(`${API_V1}/models/${tabSlug}/${recordId}`, {
    method: 'PUT',
    token,
    json: data,
  })
}

export async function deleteWindowRecord(
  token: string,
  windowSlug: string,
  tabSlug: string,
  recordId: number
): Promise<void> {
  await apiFetch(`${API_V1}/models/${tabSlug}/${recordId}`, {
    method: 'DELETE',
    token,
  })
}
```

---

## 7. 頁面元件規格

### 7.1 登入頁 (LoginPage.vue)

#### 功能需求
- 用戶名密碼輸入
- 客戶端選擇
- 角色選擇
- 組織選擇
- 倉庫選擇（可選）
- 記住登入狀態

#### 流程
```
1. 輸入用戶名密碼 → POST /api/v1/auth/tokens
2. 獲取 token 後載入客戶端列表
3. 選擇客戶端 → 載入角色列表
4. 選擇角色 → 載入組織列表
5. 選擇組織 → 載入倉庫列表
6. 完成選擇 → PUT /api/v1/auth/tokens 設置參數
7. 儲存會話 → 跳轉首頁
```

#### 狀態
```typescript
interface LoginState {
  userName: string
  password: string
  step: 'credentials' | 'client' | 'role' | 'organization' | 'warehouse'
  token: string | null
  clients: Client[]
  selectedClient: Client | null
  roles: Role[]
  selectedRole: Role | null
  organizations: Organization[]
  selectedOrganization: Organization | null
  warehouses: Warehouse[]
  selectedWarehouse: Warehouse | null
  loading: boolean
  error: string | null
}
```

### 7.2 每日關懷記錄頁 (MomReportPage.vue)

#### 功能需求
- 記錄列表顯示（可按日期篩選）
- 新增/編輯記錄
- 記錄欄位包含：晨昏狀態、飲食、活動、生理狀況、生理數據
- AI 摘要生成（Gemini API）
- PDF 匯出
- 照片上傳
- 附件管理

#### 資料結構
```typescript
interface MomData {
  id: number
  documentNo?: string
  dateDoc: string
  name: string
  description?: string

  // 晨昏狀態
  nightActivity?: string
  beforeSleepStatus?: string
  lastNightSleep?: string
  morningMentalStatus?: string

  // 飲食
  breakfast?: string
  lunch?: string
  dinner?: string

  // 活動
  dailyActivity?: string
  outgoing?: string
  companionship?: string

  // 生理狀況
  excretionStatus?: string
  bathing?: string
  safetyIncident?: string

  // 生理數據
  systolicBP?: number
  diastolicBP?: number
  pulse?: number
  bpNote?: string

  // 狀態
  docStatus: string
  isProcessed: boolean
}
```

#### API 端點
```typescript
// 列表
GET /api/v1/models/Z_momSystem?$filter=DateDoc ge '{startDate}' and DateDoc le '{endDate}'

// 新增
POST /api/v1/models/Z_momSystem

// 更新
PUT /api/v1/models/Z_momSystem/{id}

// 完成文件
PUT /api/v1/models/Z_momSystem/{id}/docaction/CO

// 上傳附件
POST /api/v1/models/Z_momSystem/{id}/attachments

// 獲取附件列表
GET /api/v1/models/Z_momSystem/{id}/attachments

// 下載附件
GET /api/v1/models/Z_momSystem/{id}/attachments/{filename}
```

#### AI 摘要
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

async function generateSummary(data: MomData): Promise<string> {
  // 從 AD_SysConfig 獲取 API Key
  const apiKey = await getSysConfig('GEMINI_API_KEY')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp'  // 或其他可用模型
  })

  const prompt = `
    請根據以下照護記錄生成一份簡潔的摘要報告：

    日期：${data.dateDoc}
    夜間活動：${data.nightActivity}
    睡眠狀況：${data.lastNightSleep}
    晨間精神：${data.morningMentalStatus}
    早餐：${data.breakfast}
    午餐：${data.lunch}
    晚餐：${data.dinner}
    日間活動：${data.dailyActivity}
    ...
  `

  const result = await model.generateContent(prompt)
  return result.response.text()
}
```

### 7.3 庫存監控頁 (StockPage.vue)

#### 功能需求
- 按產品顯示庫存
- 按倉庫分列顯示
- 安全水位警示（紅色標記）
- 7日平均消耗計算
- 效期追蹤與警示
- 缺貨品項自動置頂

#### 資料結構
```typescript
interface ProductStock {
  productId: number
  productValue: string
  productName: string

  warehouseStocks: WarehouseStock[]

  totalQty: number
  totalSafetyStock: number
  isBelowSafety: boolean

  avgConsumption7d: number

  nearestExpiryDate?: string
  isExpiringSoon: boolean
  isExpired: boolean
}

interface WarehouseStock {
  warehouseId: number
  warehouseName: string
  qtyOnHand: number
  safetyStock: number
  isBelowSafety: boolean
}
```

#### 計算邏輯
```typescript
// 消耗計算
// 僅計算 I-（領用）和 C-（出貨）類型的交易
async function calculateConsumption(productId: number): Promise<number> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const transactions = await getTransactions({
    filter: `M_Product_ID eq ${productId} and MovementDate ge '${formatDate(sevenDaysAgo)}' and (MovementType eq 'I-' or MovementType eq 'C-')`,
  })

  const totalConsumption = transactions.reduce((sum, t) => sum + Math.abs(t.MovementQty), 0)
  return totalConsumption / 7
}

// 排序優先級
function sortProducts(products: ProductStock[]): ProductStock[] {
  return products.sort((a, b) => {
    // 已過期 > 即將到期 > 低於水位 > 其他
    if (a.isExpired !== b.isExpired) return a.isExpired ? -1 : 1
    if (a.isExpiringSoon !== b.isExpiringSoon) return a.isExpiringSoon ? -1 : 1
    if (a.isBelowSafety !== b.isBelowSafety) return a.isBelowSafety ? -1 : 1
    return a.productName.localeCompare(b.productName)
  })
}
```

#### API 端點
```typescript
// 產品列表
GET /api/v1/models/M_Product?$filter=IsActive eq true and IsSold eq true

// 庫存數據
GET /api/v1/models/M_StorageOnHand?$filter=M_Product_ID eq {productId}

// 庫位資訊
GET /api/v1/models/M_Locator?$select=M_Locator_ID,M_Warehouse_ID

// 倉庫資訊
GET /api/v1/models/M_Warehouse?$select=M_Warehouse_ID,Name

// 安全水位
GET /api/v1/models/M_Replenish?$filter=M_Product_ID eq {productId}

// 庫存交易（消耗計算）
GET /api/v1/models/M_Transaction?$filter=M_Product_ID eq {productId} and MovementDate ge '{date}'

// ASI 效期
GET /api/v1/models/M_AttributeSetInstance?$select=M_AttributeSetInstance_ID,GuaranteeDate
```

---

## 8. 共用元件規格

### 8.1 DynamicForm.vue

#### 功能
- 根據 iDempiere 視窗定義自動生成表單
- 支持新建和編輯模式
- 欄位配置管理（管理員模式）
- 表單驗證和提交

#### Props
```typescript
interface Props {
  windowSlug: string              // 視窗標識
  tabSlug: string                 // 標籤標識
  recordId?: number | null        // 編輯時的記錄 ID
  excludeFields?: string[]        // 排除的欄位
  defaultValues?: Record<string, unknown>
  submitLabel?: string
  showCancel?: boolean
  showHelp?: boolean
}
```

#### Events
```typescript
interface Events {
  submit: [data: Record<string, unknown>]
  cancel: []
  loaded: [fields: TabField[]]
}
```

#### 欄位過濾邏輯
```typescript
const EXCLUDED_COLUMNS = [
  'AD_Client_ID',
  'AD_Org_ID',
  'Created',
  'CreatedBy',
  'Updated',
  'UpdatedBy',
  'IsActive',
]

function shouldShowField(field: TabField): boolean {
  if (EXCLUDED_COLUMNS.includes(field.columnName)) return false
  if (field.columnName.endsWith('_UU')) return false
  if (field.isKey) return false
  if (field.isParent) return false
  if (field.referenceId === ReferenceType.Button) return false
  if (!field.isDisplayed) return false
  return true
}
```

### 8.2 DynamicField.vue

#### 功能
- 根據欄位類型渲染對應的 HTML 控件
- 自動載入查找選項
- 支持必填驗證
- 支持多選

#### Props
```typescript
interface Props {
  field: TabField
  modelValue: unknown
  showHelp?: boolean
  adminMode?: boolean
  markedHidden?: boolean
}
```

#### 類型映射
```typescript
function getInputType(referenceId: number): string {
  switch (referenceId) {
    case ReferenceType.String:
      return 'text'
    case ReferenceType.Integer:
    case ReferenceType.Number:
    case ReferenceType.Amount:
      return 'number'
    case ReferenceType.Date:
      return 'date'
    case ReferenceType.DateTime:
      return 'datetime-local'
    case ReferenceType.YesNo:
      return 'checkbox'
    case ReferenceType.Text:
    case ReferenceType.Memo:
      return 'textarea'
    case ReferenceType.List:
    case ReferenceType.Table:
    case ReferenceType.TableDirect:
    case ReferenceType.Search:
      return 'select'
    case ReferenceType.ChosenMultipleSelectionList:
      return 'multiselect'
    default:
      return 'text'
  }
}
```

### 8.3 其他共用元件

#### ErrorMessage.vue
```vue
<script setup lang="ts">
defineProps<{ message: string | null }>()
</script>

<template>
  <div v-if="message" class="alert alert-error shadow-lg">
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{{ message }}</span>
  </div>
</template>
```

#### SuccessMessage.vue
```vue
<script setup lang="ts">
defineProps<{ message: string | null }>()
</script>

<template>
  <div v-if="message" class="alert alert-success shadow-lg">
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{{ message }}</span>
  </div>
</template>
```

#### StatusBadge.vue
```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()

const statusConfig = {
  CO: { class: 'badge-success', text: '完成' },
  DR: { class: 'badge-warning', text: '草稿' },
  VO: { class: 'badge-error', text: '作廢' },
  IP: { class: 'badge-info', text: '進行中' },
  CL: { class: 'badge-neutral', text: '關閉' },
}

const config = computed(() => statusConfig[props.status] ?? { class: 'badge-ghost', text: props.status })
</script>

<template>
  <span class="badge" :class="config.class">{{ config.text }}</span>
</template>
```

#### Pagination.vue
```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalCount: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

const totalPages = computed(() => Math.ceil(props.totalCount / props.pageSize))
const hasPrev = computed(() => props.currentPage > 1)
const hasNext = computed(() => props.currentPage < totalPages.value)
</script>

<template>
  <div class="flex justify-center items-center gap-2">
    <button class="btn btn-sm" :disabled="!hasPrev" @click="emit('update:currentPage', currentPage - 1)">
      上一頁
    </button>
    <span>第 {{ currentPage }} / {{ totalPages }} 頁</span>
    <button class="btn btn-sm" :disabled="!hasNext" @click="emit('update:currentPage', currentPage + 1)">
      下一頁
    </button>
  </div>
</template>
```

---

## 9. Composables 規格

### 9.1 useForm.ts

```typescript
import { reactive, ref } from 'vue'

interface FormOptions<T> {
  initialValues?: Partial<T>
  onSubmit: (data: T) => Promise<void>
  onSuccess?: () => void
  validate?: (data: T) => string[]
}

export function useForm<T extends Record<string, unknown>>(options: FormOptions<T>) {
  const formData = reactive<T>({ ...options.initialValues } as T)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const successMessage = ref<string | null>(null)

  async function handleSubmit(): Promise<void> {
    error.value = null
    successMessage.value = null

    // 驗證
    if (options.validate) {
      const errors = options.validate(formData as T)
      if (errors.length > 0) {
        error.value = errors.join(', ')
        return
      }
    }

    submitting.value = true
    try {
      await options.onSubmit(formData as T)
      successMessage.value = '操作成功'
      options.onSuccess?.()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '操作失敗'
    } finally {
      submitting.value = false
    }
  }

  function resetForm(): void {
    Object.assign(formData, options.initialValues ?? {})
    error.value = null
    successMessage.value = null
  }

  function setFormData(data: Partial<T>): void {
    Object.assign(formData, data)
  }

  return {
    formData,
    submitting,
    error,
    successMessage,
    handleSubmit,
    resetForm,
    setFormData,
  }
}
```

### 9.2 useList.ts

```typescript
import { ref, watch } from 'vue'

interface ListOptions<T> {
  loadFn: (params: {
    top: number
    skip: number
    filter?: string
    [key: string]: unknown
  }) => Promise<{ records: T[]; totalCount?: number }>
  pageSize?: number
  initialFilter?: Record<string, unknown>
}

export function useList<T>(options: ListOptions<T>) {
  const records = ref<T[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(1)
  const totalCount = ref(0)
  const searchQuery = ref('')
  const filter = ref<Record<string, unknown>>(options.initialFilter ?? {})
  const pageSize = options.pageSize ?? 20

  const hasNextPage = computed(() => currentPage.value * pageSize < totalCount.value)

  async function loadList(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const skip = (currentPage.value - 1) * pageSize
      const result = await options.loadFn({
        top: pageSize,
        skip,
        ...filter.value,
      })

      records.value = result.records
      if (result.totalCount !== undefined) {
        totalCount.value = result.totalCount
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '載入失敗'
      records.value = []
    } finally {
      loading.value = false
    }
  }

  function prevPage(): void {
    if (currentPage.value > 1) {
      currentPage.value--
      loadList()
    }
  }

  function nextPage(): void {
    if (hasNextPage.value) {
      currentPage.value++
      loadList()
    }
  }

  function resetPage(): void {
    currentPage.value = 1
  }

  function clearFilters(): void {
    filter.value = {}
    searchQuery.value = ''
    resetPage()
    loadList()
  }

  // 監聽搜索變化
  watch(searchQuery, () => {
    resetPage()
    loadList()
  }, { debounce: 300 })

  return {
    records,
    loading,
    error,
    currentPage,
    totalCount,
    searchQuery,
    filter,
    hasNextPage,
    loadList,
    prevPage,
    nextPage,
    resetPage,
    clearFilters,
  }
}
```

---

## 10. API 整合規格

### 10.1 HTTP 客戶端 (shared/api/http.ts)

```typescript
import ky from 'ky'

export interface ApiError {
  status: number
  title?: string
  detail?: string
  raw?: unknown
  isTokenExpired?: boolean
}

let tokenExpiredHandler: (() => void) | null = null

export function setTokenExpiredHandler(handler: () => void): void {
  tokenExpiredHandler = handler
}

const api = ky.create({
  prefixUrl: '',
  timeout: 30000,
  hooks: {
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          tokenExpiredHandler?.()
        }
        return response
      },
    ],
  },
})

export async function apiFetch<T>(
  path: string,
  options?: {
    method?: string
    token?: string
    searchParams?: Record<string, string | number | boolean | undefined>
    json?: unknown
  }
): Promise<T> {
  const headers: Record<string, string> = {}

  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  // 過濾 undefined 參數
  const searchParams: Record<string, string | number | boolean> = {}
  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) {
        searchParams[key] = value
      }
    }
  }

  try {
    const response = await api(path, {
      method: options?.method ?? 'GET',
      headers,
      searchParams: Object.keys(searchParams).length > 0 ? searchParams : undefined,
      json: options?.json,
    })

    const text = await response.text()
    if (!text) {
      return {} as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  } catch (error) {
    if (error instanceof ky.HTTPError) {
      const body = await error.response.text()
      let parsed: { title?: string; detail?: string } = {}
      try {
        parsed = JSON.parse(body)
      } catch {
        // ignore
      }

      const apiError: ApiError = {
        status: error.response.status,
        title: parsed.title,
        detail: parsed.detail,
        raw: body,
        isTokenExpired: error.response.status === 401,
      }

      throw apiError
    }
    throw error
  }
}
```

### 10.2 API 端點總覽

#### 認證端點
```
POST   /api/v1/auth/tokens              登入
PUT    /api/v1/auth/tokens              設置登入參數
GET    /api/v1/auth/clients             客戶端列表
GET    /api/v1/auth/roles               角色列表
GET    /api/v1/auth/organizations       組織列表
GET    /api/v1/auth/warehouses          倉庫列表
GET    /api/v1/auth/language            客戶端語言
```

#### 通用模型端點
```
GET    /api/v1/models/{tableName}                    列表查詢
GET    /api/v1/models/{tableName}/{id}               單筆查詢
POST   /api/v1/models/{tableName}                    新建
PUT    /api/v1/models/{tableName}/{id}               更新
DELETE /api/v1/models/{tableName}/{id}               刪除
PUT    /api/v1/models/{tableName}/{id}/docaction/{action}  文件動作
POST   /api/v1/models/{tableName}/{id}/attachments   上傳附件
GET    /api/v1/models/{tableName}/{id}/attachments   附件列表
GET    /api/v1/models/{tableName}/{id}/attachments/{filename}  下載附件
```

#### 元數據端點
```
GET    /api/v1/windows/{slug}/tabs                   視窗定義
GET    /api/v1/windows/{slug}/tabs/{tabSlug}/fields  欄位列表
GET    /api/v1/reference/{id}                        參考列表
```

#### OData 查詢參數
```
$filter     篩選條件 (例: Name eq 'Test' and IsActive eq true)
$select     選擇欄位 (例: ID,Name,Value)
$orderby    排序 (例: Name desc)
$top        限制筆數
$skip       跳過筆數
$expand     展開關聯 (例: C_BPartner_ID($select=Name))
```

---

## 11. 狀態管理

### 11.1 架構概述

本專案使用 Vue 3 Composition API 的響應式系統進行狀態管理，不使用 Vuex 或 Pinia。

```
全局狀態（模組級 ref）
├── useAuth()        → 認證會話
└── usePermission()  → 權限配置

局部狀態（組件級）
├── useList()        → 列表數據
└── useForm()        → 表單數據
```

### 11.2 持久化策略

```typescript
// 認證會話持久化
const STORAGE_KEY = 'idempiere.resource.session.v1'

// 儲存
localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

// 載入
const stored = localStorage.getItem(STORAGE_KEY)
if (stored) {
  session.value = JSON.parse(stored)
}

// 清除
localStorage.removeItem(STORAGE_KEY)
```

---

## 12. 路由與權限

### 12.1 路由定義 (routes.ts)

```typescript
import type { RouteRecordRaw } from 'vue-router'

// 懶載入頁面組件
const LoginPage = () => import('./views/LoginPage.vue')
const MomReportPage = () => import('./views/MomReportPage.vue')
const StockPage = () => import('./views/StockPage.vue')
const BookingPage = () => import('./views/BookingPage.vue')
const BPartnerPage = () => import('./views/BPartnerPage.vue')
const OrderPage = () => import('./views/OrderPage.vue')
const PaymentPage = () => import('./views/PaymentPage.vue')
const InOutPage = () => import('./views/InOutPage.vue')
const ProductionPage = () => import('./views/ProductionPage.vue')
const RequestPage = () => import('./views/RequestPage.vue')
const ReportPage = () => import('./views/ReportPage.vue')
const AdminCalendarPage = () => import('./views/AdminCalendarPage.vue')
const AdminPermissionsPage = () => import('./views/AdminPermissionsPage.vue')

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },

  // 核心功能
  { path: '/mom-report', component: MomReportPage },
  { path: '/inventory', component: StockPage },

  // 業務功能
  { path: '/book', component: BookingPage },
  { path: '/request', component: RequestPage },
  { path: '/bpartner', component: BPartnerPage },
  { path: '/receipt', component: InOutPage },
  { path: '/sales-order', component: OrderPage },
  { path: '/purchase-order', component: OrderPage },
  { path: '/payment', component: PaymentPage },
  { path: '/production', component: ProductionPage },
  { path: '/report', component: ReportPage },

  // 管理功能
  { path: '/admin/calendar', component: AdminCalendarPage },
  { path: '/admin/permissions', component: AdminPermissionsPage },
]
```

### 12.2 路由守衛

```typescript
router.beforeEach((to, from) => {
  const auth = useAuth()
  const permission = usePermission()

  // 公開路由
  const publicRoutes = new Set(['/login'])
  if (publicRoutes.has(to.path)) {
    return true
  }

  // 未認證
  if (!auth.isAuthenticated.value) {
    return { path: '/login' }
  }

  // 權限檢查
  if (permission.permissionsLoaded.value) {
    if (!permission.canAccessPath(to.path)) {
      const firstMenu = permission.visibleMenuItems.value[0]
      return firstMenu ? { path: firstMenu.path } : { path: '/login' }
    }
  }

  return true
})
```

### 12.3 權限模型

```typescript
// 用戶類型
type UserType = 'System' | 'User'

// System 用戶
// - 可存取所有功能
// - 可存取管理功能

// User 用戶
// - 僅可存取 Mom 報表和庫存
// - 無法存取管理功能
```

---

## 13. 樣式系統

### 13.1 TailwindCSS 配置

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light'],
  },
}
```

### 13.2 全域樣式 (styles.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自訂樣式 */
.page-container {
  @apply container mx-auto px-4 py-6;
}

.card-title {
  @apply text-xl font-bold mb-4;
}

.form-control {
  @apply mb-4;
}

.form-label {
  @apply block text-sm font-medium mb-1;
}

.form-input {
  @apply input input-bordered w-full;
}

.btn-primary {
  @apply btn btn-primary;
}

.btn-secondary {
  @apply btn btn-secondary;
}

/* 庫存警示樣式 */
.stock-warning {
  @apply bg-red-100 text-red-800;
}

.stock-expiring {
  @apply bg-yellow-100 text-yellow-800;
}

.stock-expired {
  @apply bg-red-200 text-red-900 font-bold;
}
```

---

## 14. 部署與建置

### 14.1 開發環境

```bash
# 安裝依賴
cd ui
bun install  # 或 npm install

# 設置環境變數
cp .env.example .env
# 編輯 .env 設置 VITE_API_IP

# 啟動開發伺服器
bun run dev  # 或 npm run dev
# 訪問 http://localhost:5173/emui/
```

### 14.2 環境變數 (.env)

```env
# iDempiere API 伺服器 IP
VITE_API_IP=127.0.0.1

# 預設登入（開發用）
VITE_DEFAULT_USER=SuperUser
VITE_DEFAULT_PASS=System
```

### 14.3 生產建置

```bash
# 建置前端
cd ui
bun run build  # 輸出到 ../web-content/

# 編譯 Java
javac -cp lib/servlet-api.jar -d build/classes \
  src/tw/mxp/emui/SpaFilter.java \
  src/tw/mxp/emui/SpaServlet.java

# 打包 JAR
jar cvfm tw.mxp.emui-1.0.1.jar META-INF/MANIFEST.MF \
  -C build/classes . \
  -C build WEB-INF \
  -C web-content index.html \
  -C web-content assets
```

### 14.4 部署到 iDempiere

```bash
# 複製 JAR 到 iDempiere 插件目錄
docker cp tw.mxp.emui-1.0.1.jar idempiere-app:/opt/idempiere/plugins/

# 重啟 iDempiere
docker restart idempiere-app

# 訪問
# http://localhost:8080/emui/
```

### 14.5 Docker 開發環境

```yaml
# docker-compose.yml
version: '3.8'

services:
  dev-server:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8888:5173"
    volumes:
      - ./ui:/app
      - /app/node_modules
    environment:
      - VITE_API_IP=192.168.0.93
      - VITE_DEFAULT_USER=SuperUser
      - VITE_DEFAULT_PASS=System
```

---

## 15. 資料結構定義

### 15.1 iDempiere 表格對應

| 功能 | iDempiere 表格 | 主鍵 |
|------|----------------|------|
| 每日關懷記錄 | Z_momSystem | Z_momSystem_ID |
| 產品 | M_Product | M_Product_ID |
| 庫存 | M_StorageOnHand | M_StorageOnHand_ID |
| 倉庫 | M_Warehouse | M_Warehouse_ID |
| 庫位 | M_Locator | M_Locator_ID |
| 補貨規則 | M_Replenish | M_Replenish_ID |
| 庫存交易 | M_Transaction | M_Transaction_ID |
| ASI | M_AttributeSetInstance | M_AttributeSetInstance_ID |
| 客戶 | C_BPartner | C_BPartner_ID |
| 訂單 | C_Order | C_Order_ID |
| 付款 | C_Payment | C_Payment_ID |
| 進出貨 | M_InOut | M_InOut_ID |
| 生產 | M_Production | M_Production_ID |
| 請求 | R_Request | R_Request_ID |
| 系統配置 | AD_SysConfig | AD_SysConfig_ID |

### 15.2 自訂表格 Z_momSystem

```sql
-- 每日關懷記錄表
CREATE TABLE Z_momSystem (
  Z_momSystem_ID      NUMBER(10) PRIMARY KEY,
  AD_Client_ID        NUMBER(10) NOT NULL,
  AD_Org_ID           NUMBER(10) NOT NULL,
  IsActive            CHAR(1) DEFAULT 'Y',
  Created             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CreatedBy           NUMBER(10),
  Updated             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy           NUMBER(10),

  -- 文件欄位
  DocumentNo          VARCHAR2(30),
  DateDoc             DATE NOT NULL,
  Name                VARCHAR2(60),
  Description         VARCHAR2(255),

  -- 晨昏狀態
  NightActivity       VARCHAR2(255),
  BeforeSleepStatus   VARCHAR2(255),
  LastNightSleep      VARCHAR2(255),
  MorningMentalStatus VARCHAR2(255),

  -- 飲食
  Breakfast           VARCHAR2(255),
  Lunch               VARCHAR2(255),
  Dinner              VARCHAR2(255),

  -- 活動
  DailyActivity       VARCHAR2(255),
  Outgoing            VARCHAR2(255),
  Companionship       VARCHAR2(255),

  -- 生理狀況
  ExcretionStatus     VARCHAR2(255),
  Bathing             VARCHAR2(255),
  SafetyIncident      VARCHAR2(255),

  -- 生理數據
  SystolicBP          NUMBER(10,2),
  DiastolicBP         NUMBER(10,2),
  Pulse               NUMBER(10,2),
  BPNote              VARCHAR2(255),

  -- 狀態
  DocStatus           CHAR(2) DEFAULT 'DR',
  Processed           CHAR(1) DEFAULT 'N',

  -- UUID
  Z_momSystem_UU      VARCHAR2(36)
);
```

### 15.3 系統配置項

| 名稱 | 值 | 說明 |
|------|-----|------|
| GEMINI_API_KEY | (API Key) | Google Gemini API 金鑰 |
| EMUI_FIELD_VISIBILITY_{WINDOW}_{ROLE} | (JSON) | 欄位可見性配置 |

---

## 附錄 A：開發檢查清單

### 新增頁面
- [ ] 創建 Vue 組件於 `ui/src/app/views/`
- [ ] 在 `routes.ts` 添加路由
- [ ] 若需要，在 `permission/types.ts` 添加菜單項
- [ ] 創建 API 模組於 `ui/src/features/`
- [ ] 添加類型定義

### 新增 API 整合
- [ ] 在 `features/` 下創建對應模組
- [ ] 定義 TypeScript 類型
- [ ] 實作 API 函數
- [ ] 處理錯誤情況

### 部署前
- [ ] 執行 `bun run build` 確認建置成功
- [ ] 檢查 `web-content/` 輸出
- [ ] 測試主要功能
- [ ] 確認 API 連接正常

---

## 附錄 B：故障排除

| 問題 | 可能原因 | 解決方案 |
|------|----------|----------|
| 白屏 | index.html 缺失 | 執行 `bun run build` |
| 404 錯誤 | SPA 路由未轉發 | 檢查 web.xml 和 SpaFilter |
| API 連接失敗 | iDempiere 未啟動 | 確認 VITE_API_IP 設置 |
| 權限拒絕 | Token 過期 | 重新登入 |
| AI 摘要失敗 | API Key 無效 | 檢查 AD_SysConfig 設置 |

---

*本設計規格書版本 1.0，適用於 iDempiere Resource UI 專案。*
