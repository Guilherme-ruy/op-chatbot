import { useState, useCallback } from 'react'
import * as sitesApi from '@/api/sites'
import type { Site, SiteFormData } from '@/types/admin'

export function useSites() {
  const [sites,        setSites]        = useState<Site[]>([])
  const [deletedSites, setDeletedSites] = useState<Site[]>([])
  const [loading,        setLoading]        = useState(false)
  const [loadingDeleted, setLoadingDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSites = useCallback(async () => {
    setLoading(true); setError(null)
    try   { setSites(await sitesApi.getSites()) }
    catch (e: any) { setError(e?.response?.data?.error ?? 'Erro ao carregar sites.') }
    finally { setLoading(false) }
  }, [])

  const fetchDeletedSites = useCallback(async () => {
    setLoadingDeleted(true)
    try   { setDeletedSites(await sitesApi.getDeletedSites()) }
    catch { /* silencioso */ }
    finally { setLoadingDeleted(false) }
  }, [])

  const create = useCallback(async (form: SiteFormData): Promise<Site> => {
    const site = await sitesApi.createSite(form)
    setSites(prev => [site, ...prev])
    return site
  }, [])

  const update = useCallback(async (id: string, form: Partial<SiteFormData> & { active?: boolean }): Promise<void> => {
    const updated = await sitesApi.updateSite(id, form)
    setSites(prev => prev.map(s => s.id === id ? updated : s))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    await sitesApi.deleteSite(id)
    setSites(prev => prev.filter(s => s.id !== id))
  }, [])

  const restore = useCallback(async (id: string): Promise<void> => {
    const restored = await sitesApi.restoreSite(id)
    setDeletedSites(prev => prev.filter(s => s.id !== id))
    setSites(prev => [restored, ...prev])
  }, [])

  const regenerateToken = useCallback(async (id: string): Promise<string> => {
    const token = await sitesApi.regenerateToken(id)
    setSites(prev => prev.map(s => s.id === id ? { ...s, token } : s))
    return token
  }, [])

  return {
    sites, deletedSites, loading, loadingDeleted, error,
    fetchSites, fetchDeletedSites, create, update, remove, restore, regenerateToken,
  }
}
