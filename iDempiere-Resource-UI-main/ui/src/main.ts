import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from './app/App.vue'
import { routes } from './app/routes'

import { useAuth } from './features/auth/store'
import { usePermission } from './features/permission/store'
import './app/styles.css'

const auth = useAuth()
const permission = usePermission()

auth.load()

// 如果已登入，載入權限
if (auth.isAuthenticated.value && auth.token.value && auth.roleId.value && auth.userId.value && auth.clientId.value && auth.organizationId.value) {
  permission.loadPermissions(auth.token.value, auth.roleId.value, auth.userId.value, auth.clientId.value, auth.organizationId.value)
}

const router = createRouter({
  history: createWebHistory('/emui/'),
  routes,
})

router.beforeEach((to) => {
  const publicRoutes = new Set(['/login'])
  if (publicRoutes.has(to.path))
    return true
  if (!auth.isAuthenticated.value)
    return { path: '/login' }

  // 權限未載入完成時，先放行
  if (!permission.permissionsLoaded.value)
    return true

  // 檢查路徑權限
  if (!permission.canAccessPath(to.path)) {
    console.warn(`Access denied to ${to.path}`)
    const firstMenu = permission.visibleMenuItems.value[0]
    // 避免無限迴圈：若目標已是第一個選單或 /book，直接放行
    if (firstMenu && firstMenu.path !== to.path) {
      return { path: firstMenu.path }
    }
    // 沒有可用選單時，導向登入頁
    if (!firstMenu) {
      return { path: '/login' }
    }
  }

  return true
})

createApp(App).use(router).mount('#app')
