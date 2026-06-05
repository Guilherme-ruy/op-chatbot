import { api } from './client'
import type { SessionFilters, SessionsResponse, SessionMessage } from '@/types/admin'

export async function getSessions(filters: SessionFilters): Promise<SessionsResponse> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
  const { data } = await api.get<SessionsResponse>('/sessions', { params })
  return data
}

export async function getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const { data } = await api.get<SessionMessage[]>(`/sessions/${sessionId}/messages`)
  return data
}
