import { useState, useCallback } from 'react'
import { getSessions, getSessionMessages } from '@/api/sessions'
import type { Session, SessionMessage, SessionFilters } from '@/types/admin'

const DEFAULT_FILTERS: SessionFilters = {
  siteId: undefined, status: undefined,
  dateFrom: undefined, dateTo: undefined,
  page: 1, limit: 25,
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [filters,  setFilters]  = useState<SessionFilters>({ ...DEFAULT_FILTERS })

  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [messages,        setMessages]        = useState<SessionMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replayError,     setReplayError]     = useState<string | null>(null)

  const fetchSessions = useCallback(async (overrideFilters?: SessionFilters) => {
    setLoading(true); setError(null)
    try {
      const f   = overrideFilters ?? filters
      const res = await getSessions(f)
      setSessions(res.sessions); setTotal(res.total)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao carregar sessões.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const openReplay = useCallback(async (session: Session) => {
    setSelectedSession(session); setMessages([]); setReplayError(null); setLoadingMessages(true)
    try   { setMessages(await getSessionMessages(session.id)) }
    catch (e: any) { setReplayError(e?.response?.data?.error ?? 'Não foi possível carregar as mensagens.') }
    finally { setLoadingMessages(false) }
  }, [])

  const closeReplay = useCallback(() => {
    setSelectedSession(null); setMessages([]); setReplayError(null)
  }, [])

  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), [])

  const updateFilters = useCallback((update: Partial<SessionFilters>) => {
    setFilters(prev => ({ ...prev, ...update }))
  }, [])

  return {
    sessions, total, loading, error, filters, setFilters, updateFilters, fetchSessions, resetFilters,
    selectedSession, messages, loadingMessages, replayError, openReplay, closeReplay,
  }
}
