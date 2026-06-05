import { useState, useCallback, useRef } from 'react'
import { getLeads, exportLeadsCSV } from '@/api/leads'
import type { Lead, LeadFilters } from '@/types/admin'

const DEFAULT_FILTERS: LeadFilters = {
  siteId: undefined, dateFrom: undefined, dateTo: undefined,
  search: undefined, projectType: undefined, page: 1, limit: 20,
}

export function useLeads() {
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [fetchError,  setFetchError]  = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [filters,     setFilters]     = useState<LeadFilters>({ ...DEFAULT_FILTERS })

  const fetchLeads = useCallback(async (overrideFilters?: LeadFilters) => {
    setLoading(true); setFetchError(null)
    try {
      const f = overrideFilters ?? filters
      const res = await getLeads(f)
      setLeads(res.leads); setTotal(res.total)
    } catch (e: any) {
      setFetchError(e?.response?.data?.error ?? 'Erro ao carregar leads.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const exportCSV = useCallback(async () => {
    setExporting(true); setExportError(null)
    try   { await exportLeadsCSV(filters) }
    catch { setExportError('Erro ao exportar CSV. Tente novamente.') }
    finally { setExporting(false) }
  }, [filters])

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
  }, [])

  const updateFilters = useCallback((update: Partial<LeadFilters>) => {
    setFilters(prev => ({ ...prev, ...update }))
  }, [])

  return {
    leads, total, loading, exporting, fetchError, exportError,
    filters, setFilters, updateFilters, fetchLeads, exportCSV, resetFilters,
  }
}
