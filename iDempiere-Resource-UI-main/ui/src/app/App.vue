<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../features/auth/store'
import { usePermission } from '../features/permission/store'
import { setTokenExpiredHandler } from '../shared/api/http'

const router = useRouter()
const route = useRoute()
const auth = useAuth()
const permission = usePermission()
const errorMessage = ref<string | null>(null)

const isLoginPage = computed(() => route.path === '/login')
const isAuthenticated = computed(() => auth.isAuthenticated.value)
const isSystem = computed(() => permission.isSystem.value)
const visibleMenuItems = computed(() => permission.visibleMenuItems.value)
const userDisplayName = computed(() => auth.userName.value || `User #${auth.userId.value}`)
const roleDisplay = computed(() => {
  if (isSystem.value)
    return 'System'
  if (auth.roleName.value) {
    return `Role: ${auth.roleName.value}`
  }
  else if (auth.roleId.value) {
    return `Role: ${auth.roleId.value}`
  }
  return null
})
const clientDisplay = computed(() => {
  if (auth.clientName.value) {
    return `Client: ${auth.clientName.value}`
  }
  else if (auth.clientId.value) {
    return `Client: ${auth.clientId.value}`
  }
  return null
})

function logout(): void {
  auth.clear()
  permission.resetPermissions()
  router.push('/login')
}

function handleTokenExpired(): void {
  auth.clear()
  permission.resetPermissions()
  errorMessage.value = '登入已過期，請重新登入'
  setTimeout(() => {
    errorMessage.value = null
  }, 3000)
  router.push('/login')
}

onMounted(() => {
  setTokenExpiredHandler(handleTokenExpired)
})
</script>

<template>
  <div class="min-h-screen">
    <header v-if="!isLoginPage" class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
            <span class="text-sm font-semibold">Rx</span>
          </div>
          <div>
            <div class="text-sm font-semibold leading-tight">
              預約系統
            </div>
            <div class="text-xs text-slate-500">
              iDempiere Resource
            </div>
          </div>
        </div>
        <nav class="flex items-center gap-2 text-sm">
          <template v-if="isAuthenticated">
            <RouterLink
              v-for="item in visibleMenuItems"
              :key="item.id"
              class="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              :to="item.path"
            >
              {{ item.name }}
              <span v-if="item.id.startsWith('SYS_')" class="ml-1 text-xs text-amber-600">(S)</span>
            </RouterLink>
          </template>

          <!-- User info (when authenticated) -->
          <div v-if="isAuthenticated" class="ml-2 flex items-center gap-3 border-l border-slate-200 pl-3">
            <div class="text-right">
              <div class="text-sm font-medium text-slate-900">
                {{ userDisplayName }}
              </div>
              <div v-if="roleDisplay" class="text-xs text-slate-500">
                {{ roleDisplay }}
              </div>
              <div v-if="clientDisplay" class="text-xs text-slate-500">
                {{ clientDisplay }}
              </div>
            </div>
            <button
              class="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
              type="button"
              @click="logout"
            >
              登出
            </button>
          </div>
          <RouterLink v-else class="rounded-md bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700" to="/login">
            登入
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-screen-2xl px-4 py-6">
      <div v-if="errorMessage" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorMessage }}</span>
      </div>
      <RouterView />
    </main>
  </div>
</template>
