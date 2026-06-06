import { api } from './client'
import type { SiteField, SiteFieldFormData } from '@/types/admin'

export async function getSiteFields(siteId: string): Promise<SiteField[]> {
  const { data } = await api.get<SiteField[]>(`/sites/${siteId}/fields`)
  return data
}

export async function createSiteField(siteId: string, form: SiteFieldFormData): Promise<SiteField> {
  const { data } = await api.post<SiteField>(`/sites/${siteId}/fields`, form)
  return data
}

export async function updateSiteField(
  siteId: string,
  fieldId: string,
  form: Partial<Omit<SiteFieldFormData, 'key'>>
): Promise<SiteField> {
  const { data } = await api.patch<SiteField>(`/sites/${siteId}/fields/${fieldId}`, form)
  return data
}

export async function deleteSiteField(siteId: string, fieldId: string): Promise<void> {
  await api.delete(`/sites/${siteId}/fields/${fieldId}`)
}

export async function reorderSiteFields(siteId: string, ids: string[]): Promise<SiteField[]> {
  const { data } = await api.put<SiteField[]>(`/sites/${siteId}/fields/reorder`, { ids })
  return data
}

export async function resetSiteFields(siteId: string): Promise<SiteField[]> {
  const { data } = await api.post<SiteField[]>(`/sites/${siteId}/fields/reset`)
  return data
}
