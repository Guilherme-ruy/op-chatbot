import axios from 'axios'
import type { LoginResponse, AdminUser } from '@/types/admin'

export async function login(credentials: { email: string; password: string }): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>('/api/admin/auth/login', credentials)
  return data
}

export async function getMe(token: string): Promise<AdminUser> {
  const { data } = await axios.get<AdminUser>('/api/admin/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}
