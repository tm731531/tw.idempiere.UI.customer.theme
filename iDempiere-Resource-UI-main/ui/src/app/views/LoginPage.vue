<script setup lang="ts">
import type { ClientOption, NamedId } from '../../features/auth/types'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getClientLanguage, getOrganizations, getRoles, getWarehouses, login, setLoginParameters } from '../../features/auth/api'
import { useAuth } from '../../features/auth/store'
import { usePermission } from '../../features/permission/store'

// Dev defaults from env (方便測試)
const userName = ref(import.meta.env.VITE_DEFAULT_USER || '')
const password = ref(import.meta.env.VITE_DEFAULT_PASS || '')
const loading = ref(false)
const error = ref<string | null>(null)

const router = useRouter()
const auth = useAuth()
const permission = usePermission()

// Form fields
const language = ref<string>('zh_TW')
const selectRole = ref(false)
const rememberMe = ref(false)

// Role selection fields
const clients = ref<ClientOption[]>([])
const clientId = ref<number | null>(null)
const roleId = ref<number | null>(null)
const organizationId = ref<number | null>(null)
const warehouseId = ref<number | null>(null)

const roles = ref<NamedId[]>([])
const organizations = ref<NamedId[]>([])
const warehouses = ref<NamedId[]>([])

// Watch for client selection to load roles
watch([clientId, selectRole], async ([id, shouldSelect]) => {
  if (!shouldSelect || !id) {
    roles.value = []
    organizations.value = []
    warehouses.value = []
    roleId.value = null
    organizationId.value = null
    warehouseId.value = null
    return
  }

  error.value = null
  try {
    // Get temporary token for role selection
    const tempRes = await login({ userName: userName.value.trim(), password: password.value.trim() })
    if (!tempRes.token)
      throw new Error('無法取得臨時權杖')

    const lang = await getClientLanguage(id, tempRes.token)
    language.value = lang.language || language.value
    roles.value = await getRoles(id, tempRes.token)

    // Preselect first role if only one
    if (roles.value.length === 1)
      roleId.value = roles.value[0].id
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || '載入角色失敗'
  }
})

// Watch for role selection to load organizations
watch([roleId, clientId, selectRole], async ([rid, cid, shouldSelect]) => {
  if (!shouldSelect || !cid || !rid) {
    organizations.value = []
    warehouses.value = []
    organizationId.value = null
    warehouseId.value = null
    return
  }

  error.value = null
  try {
    // Get temporary token for organization selection
    const tempRes = await login({ userName: userName.value.trim(), password: password.value.trim() })
    if (!tempRes.token)
      throw new Error('無法取得臨時權杖')

    organizations.value = await getOrganizations(cid, rid, tempRes.token)

    // Preselect first organization if only one
    if (organizations.value.length === 1)
      organizationId.value = organizations.value[0].id
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || '載入組織失敗'
  }
})

// Watch for organization selection to load warehouses
watch([organizationId, clientId, roleId, selectRole], async ([oid, cid, rid, shouldSelect]) => {
  if (!shouldSelect || !cid || !rid || !oid) {
    warehouses.value = []
    warehouseId.value = null
    return
  }

  error.value = null
  try {
    // Get temporary token for warehouse selection
    const tempRes = await login({ userName: userName.value.trim(), password: password.value.trim() })
    if (!tempRes.token)
      throw new Error('Failed to get temporary token')

    warehouses.value = await getWarehouses(cid, rid, oid, tempRes.token)
  }
  catch {
    // warehouse is optional; don't show error
    warehouses.value = []
  }
})

// Load clients when selectRole is enabled
watch(selectRole, async (shouldSelect) => {
  if (!shouldSelect) {
    clients.value = []
    clientId.value = null
    roles.value = []
    organizations.value = []
    warehouses.value = []
    roleId.value = null
    organizationId.value = null
    warehouseId.value = null
    return
  }

  error.value = null
  try {
    // Get temporary token to load clients
    const tempRes = await login({ userName: userName.value.trim(), password: password.value.trim() })
    if (!tempRes.token)
      throw new Error('無法取得臨時權杖')

    clients.value = tempRes.clients ?? []

    // Preselect first client if only one
    if (clients.value.length === 1)
      clientId.value = clients.value[0].id
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || '載入客戶失敗'
  }
})

async function onSubmitLogin() {
  error.value = null
  loading.value = true

  try {
    // Step 1: Basic login to get temporary token
    const tempRes = await login({
      userName: userName.value.trim(),
      password: password.value.trim(),
    })

    if (!tempRes.token)
      throw new Error('無法取得權杖')

    // If selectRole is not checked, auto-select first available client/role/org
    let finalClientId = clientId.value
    let finalRoleId = roleId.value
    let finalOrgId = organizationId.value
    const finalWarehouseId = warehouseId.value
    let finalClientName: string | undefined
    let finalRoleName: string | undefined

    if (!selectRole.value) {
      // Auto-select first client
      const availableClients = tempRes.clients ?? []
      if (availableClients.length === 0)
        throw new Error('無可用的客戶')
      finalClientId = availableClients[0].id
      finalClientName = availableClients[0].name

      // Get roles for first client
      const availableRoles = await getRoles(finalClientId, tempRes.token)
      if (availableRoles.length === 0)
        throw new Error('無可用的角色')
      finalRoleId = availableRoles[0].id
      finalRoleName = availableRoles[0].name

      // Get organizations for first role
      const availableOrgs = await getOrganizations(finalClientId, finalRoleId, tempRes.token)
      if (availableOrgs.length === 0)
        throw new Error('無可用的組織')
      finalOrgId = availableOrgs[0].id
    }
    else {
      // Find names from selected options
      const selectedClient = clients.value.find(c => c.id === finalClientId)
      finalClientName = selectedClient?.name
      const selectedRole = roles.value.find(r => r.id === finalRoleId)
      finalRoleName = selectedRole?.name
    }

    if (finalClientId == null || finalRoleId == null || finalOrgId == null) {
      throw new Error('請選擇客戶、角色和組織')
    }

    // Step 2: Set login parameters to get final token
    const finalRes = await setLoginParameters(
      {
        clientId: finalClientId,
        roleId: finalRoleId,
        organizationId: finalOrgId,
        warehouseId: finalWarehouseId ?? undefined,
        language: language.value,
      },
      tempRes.token,
    )

    if (!finalRes.token || !finalRes.userId) {
      throw new Error('登入參數設定失敗')
    }

    // Store session
    auth.set({
      token: finalRes.token,
      refreshToken: finalRes.refresh_token,
      userId: finalRes.userId,
      clientId: finalClientId,
      clientName: finalClientName,
      organizationId: finalOrgId,
      roleId: finalRoleId,
      roleName: finalRoleName,
      warehouseId: finalWarehouseId ?? undefined,
      language: finalRes.language || language.value,
    })

    // Load permissions
    await permission.loadPermissions(
      finalRes.token,
      finalRoleId,
      finalRes.userId,
      finalClientId,
      finalOrgId,
    )

    // Navigate to first available menu
    const firstMenu = permission.visibleMenuItems.value[0]
    await router.push(firstMenu?.path || '/book')
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '登入失敗'
  }
  finally {
    loading.value = false
  }
}

function onForgotPassword() {
  // TODO: Implement forgot password functionality
  alert('忘記密碼功能尚未實現')
}

function onHelp() {
  // TODO: Implement help functionality
  window.open('https://wiki.idempiere.org/en/Login_Help', '_blank')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-100 p-4">
    <div class="w-full max-w-sm">
      <form class="space-y-3" @submit.prevent="onSubmitLogin">
        <!-- Username/Email -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">用戶</span>
          </label>
          <input
            v-model="userName"
            type="text"
            placeholder="例如：GardenAdmin"
            class="input input-bordered input-sm"
            autocomplete="username"
            required
          >
        </div>

        <!-- Password -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">密碼</span>
          </label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="input input-bordered input-sm"
            autocomplete="current-password"
            required
          >
        </div>

        <!-- Language -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">語言</span>
          </label>
          <select v-model="language" class="select select-bordered select-sm">
            <option value="zh_TW">
              中文 (繁體)
            </option>
            <option value="zh_CN">
              中文 (簡體)
            </option>
            <option value="en_US">
              English
            </option>
            <option value="ja_JP">
              日本語
            </option>
          </select>
        </div>

        <!-- Select Role checkbox -->
        <div class="form-control">
          <label class="label cursor-pointer">
            <input
              v-model="selectRole"
              type="checkbox"
              class="checkbox checkbox-primary"
            >
            <span class="label-text ml-2">選擇角色</span>
          </label>
        </div>

        <!-- Role selection fields (shown when selectRole is true) -->
        <div v-if="selectRole" class="space-y-3 border-t pt-3">
          <!-- Client/Tenant -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">客戶</span>
            </label>
            <select v-model="clientId" class="select select-bordered select-sm" :disabled="!clients.length">
              <option :value="null" disabled>
                選擇客戶
              </option>
              <option v-for="c in clients" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <!-- Role and Organization -->
          <div class="grid gap-4 grid-cols-2">
            <div class="form-control">
              <label class="label">
                <span class="label-text">角色</span>
              </label>
              <select v-model="roleId" class="select select-bordered select-sm" :disabled="!roles.length">
                <option :value="null" disabled>
                  選擇角色
                </option>
                <option v-for="r in roles" :key="r.id" :value="r.id">
                  {{ r.name }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">組織</span>
              </label>
              <select v-model="organizationId" class="select select-bordered select-sm" :disabled="!organizations.length">
                <option :value="null" disabled>
                  選擇組織
                </option>
                <option v-for="o in organizations" :key="o.id" :value="o.id">
                  {{ o.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Warehouse (optional) -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">倉庫 <span class="text-sm opacity-60">(可選)</span></span>
            </label>
            <select v-model="warehouseId" class="select select-bordered select-sm">
              <option :value="null">
                未指定
              </option>
              <option v-for="w in warehouses" :key="w.id" :value="w.id">
                {{ w.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="error" class="alert alert-error py-1 text-sm">
          {{ error }}
        </div>

        <!-- Buttons and Remember Me -->
        <div class="space-y-2">
          <button
            class="btn btn-primary w-full"
            :disabled="loading || (selectRole && (!clientId || !roleId || !organizationId))"
            type="submit"
          >
            {{ loading ? '登入中...' : '確定' }}
          </button>

          <!-- Remember Me Toggle -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <input
                v-model="rememberMe"
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
              >
              <span class="text-sm font-medium">記住我</span>
            </div>

            <div class="flex gap-4 text-sm">
              <a href="#" class="link link-primary" @click.prevent="onForgotPassword">忘記密碼</a>
              <a href="#" class="link link-primary" @click.prevent="onHelp">說明</a>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
