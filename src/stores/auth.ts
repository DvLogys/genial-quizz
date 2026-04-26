import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/types'
import * as authApi from '@/api/auth'
import { getToken, setToken } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function init() {
    if (initialized.value) return
    if (!getToken()) {
      initialized.value = true
      return
    }
    try {
      user.value = await authApi.me()
    } catch {
      setToken(null)
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(username: string, password: string) {
    const res = await authApi.login(username, password)
    setToken(res.token)
    user.value = res.user
  }

  async function register(username: string, email: string, password: string) {
    const res = await authApi.register(username, email, password)
    setToken(res.token)
    user.value = res.user
  }

  function logout() {
    setToken(null)
    user.value = null
  }

  return {
    user,
    initialized,
    isAuthenticated,
    init,
    login,
    register,
    logout,
  }
})
