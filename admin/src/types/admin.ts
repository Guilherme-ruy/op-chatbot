export interface Site {
  id: string
  name: string
  domain: string
  token: string
  bot_name: string
  bot_avatar_url: string | null
  whatsapp_number: string | null
  plan_name: string | null
  monthly_session_limit: number | null
  limit_message: string | null
  active: boolean
  deleted_at: string | null
  created_at: string
  total_sessions: number
  qualified_sessions: number
  total_leads: number
}

export interface SiteDetailStats {
  site: Site | null  // null na visão de todos os sites
  // Mês corrente (card "Uso mensal")
  sessions_this_month:      number
  qualified_this_month:     number
  // Totais históricos
  total_sessions_all:       number
  total_leads_all:          number
  // Métricas do período selecionado
  leads_in_period:          number
  avg_messages_per_session: number
  abandonment_rate:         number
  sessions_by_day:  { date: string; sessions: number; leads: number }[]
  leads_by_project: { type: string; count: number }[]
  peak_hours:       { hour: number; count: number }[]
  recent_leads: {
    id: string; name: string | null; contact: string | null
    project_type: string | null; whatsapp_url: string | null; created_at: string
    site_name?: string
  }[]
}

export interface AdminUser { id: string; email: string }
export interface LoginResponse { token: string; email: string }

export interface Lead {
  id: string
  session_id: string
  name: string | null
  contact: string | null
  project_type: string | null
  client_type: 'pf' | 'pj' | null
  cnpj: string | null
  budget: string | null
  custom_data: Record<string, string | null>
  site_source: string | null
  whatsapp_url: string | null
  notified_at: string | null
  created_at: string
  site_name: string
  site_domain: string
}

export interface LeadFilters {
  siteId?: string; dateFrom?: string; dateTo?: string
  search?: string; page?: number; limit?: number
}

export interface SessionMessage {
  id: string; role: 'user' | 'bot'; content: string; created_at: string
}

export interface Session {
  id: string; site_id: string; site_name: string; site_domain: string
  status: 'active' | 'qualified' | 'abandoned'
  message_count: number; collected_data: Record<string, string | null>
  created_at: string; updated_at: string
}

export interface SessionFilters {
  siteId?: string; status?: string; dateFrom?: string; dateTo?: string
  page?: number; limit?: number
}

export interface SessionsResponse { sessions: Session[]; total: number; page: number; limit: number }
export interface LeadsResponse    { leads: Lead[];       total: number; page: number; limit: number }

export interface SiteFormData {
  name: string; domain: string; bot_name: string
  bot_avatar_url?: string | null; whatsapp_number?: string | null
  monthly_session_limit?: number | null; limit_message?: string | null
}

export interface SiteField {
  id: string
  site_id: string
  key: string
  label: string
  hint: string | null
  required: boolean
  sort_order: number
  created_at: string
}

export interface SiteFieldFormData {
  key: string
  label: string
  hint?: string | null
  required: boolean
  sort_order?: number
}

// ── SMTP Settings ─────────────────────────────────────────────────────────────

/** Configuração SMTP retornada pela API (senha nunca exposta). */
export interface SmtpSettingsPublic {
  id:                 number
  host:               string
  port:               number
  user_email:         string
  pass_configured:    boolean
  from_address:       string
  notification_email: string
  updated_at:         string
}

/** Payload para salvar configuração SMTP. */
export interface SmtpSettingsInput {
  host:               string
  port:               number
  user_email:         string
  pass?:              string  // omitir ou vazio = mantém senha existente
  from_address:       string
  notification_email: string
}
