import { api } from './client'
import type { LeadFilters, LeadsResponse } from '@/types/admin'

export async function getLeads(filters: LeadFilters): Promise<LeadsResponse> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
  const { data } = await api.get<LeadsResponse>('/leads', { params })
  return data
}

export async function exportLeadsCSV(filters: LeadFilters): Promise<void> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
  const response = await api.get('/leads/export', { params, responseType: 'blob' })
  const url  = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href  = url
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
