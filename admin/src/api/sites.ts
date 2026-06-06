import { api } from './client'
import type { Site, SiteFormData, SiteDetailStats } from '@/types/admin'

export async function getSites(): Promise<Site[]> {
  const { data } = await api.get<Site[]>('/sites')
  return data
}

export async function getDeletedSites(): Promise<Site[]> {
  const { data } = await api.get<Site[]>('/sites/deleted')
  return data
}

export async function createSite(form: SiteFormData): Promise<Site> {
  const { data } = await api.post<Site>('/sites', form)
  return data
}

export async function updateSite(id: string, form: Partial<SiteFormData> & { active?: boolean }): Promise<Site> {
  const { data } = await api.patch<Site>(`/sites/${id}`, form)
  return data
}

export async function deleteSite(id: string): Promise<void> {
  await api.delete(`/sites/${id}`)
}

export async function restoreSite(id: string): Promise<Site> {
  const { data } = await api.post<Site>(`/sites/${id}/restore`)
  return data
}

export async function getSiteStats(id: string, days = 30): Promise<SiteDetailStats> {
  const { data } = await api.get<SiteDetailStats>(`/sites/${id}/stats`, { params: { days } })
  return data
}

export async function getAllSitesStats(days = 30): Promise<SiteDetailStats> {
  const { data } = await api.get<SiteDetailStats>('/sites/all/stats', { params: { days } })
  return data
}

export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ url: string }>('/upload/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}

export async function deleteAvatar(path: string): Promise<void> {
  await api.delete('/upload/avatar', { data: { path } })
}

export async function regenerateToken(id: string): Promise<string> {
  const { data } = await api.post<{ token: string }>(`/sites/${id}/regenerate-token`)
  return data.token
}
