import { create } from 'zustand'
import { login as apiLogin } from '@/api/auth'
import type { LoginResponse } from '@/types/admin'

const TOKEN_KEY = 'admin_token'
const EMAIL_KEY = 'admin_email'

interface AuthStore {
  token: string | null
  email: string | null
  isAuthenticated: boolean
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  email: localStorage.getItem(EMAIL_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  login: async (credentials) => {
    const data: LoginResponse = await apiLogin(credentials)
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(EMAIL_KEY, data.email)
    set({ token: data.token, email: data.email, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    set({ token: null, email: null, isAuthenticated: false })
  },
}))
