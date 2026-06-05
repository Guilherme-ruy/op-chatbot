import { api } from './client'

export interface DashboardStats {
  total_sites_active:  number
  total_sessions_30d:  number
  total_qualified_30d: number
  total_leads_30d:     number
  qualification_rate:  number
  leads_by_day:     { date: string; count: number }[]
  leads_by_project: { type: string; count: number }[]
  top_sites:        { name: string; domain: string; leads: number; sessions: number }[]
}

export async function getDashboard(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard')
  return data
}
