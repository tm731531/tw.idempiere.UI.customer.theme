<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuth } from '../../features/auth/store'
import { getUserMenuPermissions, listUsers, setUserMenuPermission } from '../../features/permission/api'
import { usePermission } from '../../features/permission/store'

const auth = useAuth()
const permission = usePermission()

const users = ref<{ id: number, name: string }[]>([])
const selectedUserId = ref<number | null>(null)
const enabledMenuIds = ref<string[]>([])

const loadingUsers = ref(false)
const loadingPermissions = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const menuItems = permission.allMenuItems

onMounted(async () => {
  await loadUsers()
})

async function loadUsers() {
  if (!auth.token.value)
    return
  loadingUsers.value = true
  error.value = null
  try {
    users.value = await listUsers(auth.token.value)
  }
  catch (e: any) {
    error.value = e?.message || '載入使用者失敗'
  }
  finally {
    loadingUsers.value = false
  }
}

watch(selectedUserId, async (userId) => {
  if (!userId || !auth.token.value) {
    enabledMenuIds.value = []
    return
  }
  loadingPermissions.value = true
  error.value = null
  try {
    enabledMenuIds.value = await getUserMenuPermissions(auth.token.value, userId)
  }
  catch (e: any) {
    error.value = e?.message || '載入權限失敗'
    enabledMenuIds.value = []
  }
  finally {
    loadingPermissions.value = false
  }
})

async function toggleMenu(menuId: string, enabled: boolean) {
  if (!selectedUserId.value || !auth.token.value)
    return
  saving.value = true
  error.value = null
  try {
    const success = await setUserMenuPermission(auth.token.value, selectedUserId.value, menuId, enabled)
    if (success) {
      if (enabled) {
        enabledMenuIds.value = [...enabledMenuIds.value, menuId]
      }
      else {
        enabledMenuIds.value = enabledMenuIds.value.filter(id => id !== menuId)
      }
    }
    else {
      error.value = '儲存失敗'
    }
  }
  catch (e: any) {
    error.value = e?.message || '儲存失敗'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">
          權限管理
        </h1>
        <p class="text-sm text-slate-500">
          設定使用者的選單存取權限
        </p>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="form-control max-w-xs">
          <label class="label">
            <span class="label-text">選擇使用者</span>
          </label>
          <select v-model="selectedUserId" class="select select-bordered select-sm" :disabled="loadingUsers">
            <option :value="null" disabled>
              請選擇使用者
            </option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.name }} (#{{ u.id }})
            </option>
          </select>
        </div>

        <div v-if="loadingUsers" class="py-8 text-center text-sm text-slate-500">
          載入使用者列表中...
        </div>
      </div>
    </div>

    <div v-if="selectedUserId" class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <h2 class="card-title text-base">
          選單權限
        </h2>

        <div v-if="loadingPermissions" class="py-8 text-center text-sm text-slate-500">
          載入權限中...
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="item in menuItems"
            :key="item.id"
            class="flex items-center justify-between rounded-lg border border-slate-200 p-3"
          >
            <div>
              <div class="font-medium">
                {{ item.name }}
              </div>
              <div class="text-xs text-slate-500">
                {{ item.description || item.path }}
              </div>
            </div>
            <input
              type="checkbox"
              class="toggle toggle-primary toggle-sm"
              :checked="enabledMenuIds.includes(item.id)"
              @change="toggleMenu(item.id, ($event.target as HTMLInputElement).checked)"
            >
          </div>
        </div>

        <div v-if="saving" class="mt-4 text-center text-sm text-slate-500">
          儲存中...
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error py-2 text-sm">
      {{ error }}
    </div>
  </div>
</template>
