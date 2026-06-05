// ── Banco de dados ────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  domain: string;
  token: string;
  bot_name: string;
  bot_avatar_url: string | null;
  whatsapp_number: string | null;
  plan_name: string | null;
  monthly_session_limit: number | null;
  active: boolean;
  deleted_at: Date | null;
  created_at: Date;
}

export interface Session {
  id: string;
  site_id: string;
  status: 'active' | 'qualified' | 'abandoned';
  message_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'bot';
  content: string;
  created_at: Date;
}

export interface Lead {
  id: string;
  session_id: string;
  name: string | null;
  project_type: string | null;
  client_type: 'pf' | 'pj' | null;
  cnpj: string | null;
  contact: string | null;
  budget: string | null;
  site_source: string | null;
  whatsapp_url: string | null;
  notified_at: Date | null;
  created_at: Date;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  last_login_at: Date | null;
}

export interface SiteWithStats extends Site {
  deleted_at: Date | null;
  total_sessions: number;
  qualified_sessions: number;
  total_leads: number;
}

// Extensão do tipo de request do Fastify para injetar adminUser no preHandler
declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: { id: string; email: string };
  }
}

// ── LLM ──────────────────────────────────────────────────────────────────────

export interface CollectedData {
  name: string | null;
  projectType: string | null;
  clientType: 'pf' | 'pj' | null;
  cnpj: string | null;
  contact: string | null;
  budget: string | null;
}

export interface LLMResponse {
  message: string;
  qualified: boolean;
  collected: CollectedData;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface StartSessionBody {
  token: string;
}

export interface SendMessageBody {
  sessionId: string;
  message: string;
}

export interface ChatStartResponse {
  sessionId: string;
  botName: string;
  botAvatarUrl: string | null;
  welcomeMessage: string;
}

export interface ChatMessageResponse {
  message: string;
  qualified: boolean;
  whatsappUrl?: string;
}
