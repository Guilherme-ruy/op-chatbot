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

export async function getSiteStats(id: string): Promise<SiteDetailStats> {
  const { data } = await api.get<SiteDetailStats>(`/sites/${id}/stats`)
  return data
}

export async function regenerateToken(id: string): Promise<string> {
  const { data } = await api.post<{ token: string }>(`/sites/${id}/regenerate-token`)
  return data.token
}
