import type { Site, Session, Message, CollectedData } from '../types';
import { pool } from '../db/pool';

// ── Sites ─────────────────────────────────────────────────────────────────────

export async function getSiteByToken(token: string): Promise<Site | null> {
  const { rows } = await pool.query<Site>(
    'SELECT * FROM sites WHERE token = $1 AND deleted_at IS NULL LIMIT 1',
    [token]
  );
  return rows[0] ?? null;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * Conta quantas sessões o site abriu no mês corrente.
 * Usado para verificar o limite mensal antes de criar nova sessão.
 */
export async function countMonthlySessionsForSite(siteId: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM sessions
     WHERE site_id = $1
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
    [siteId]
  );
  return rows[0]?.count ?? 0;
}

export async function createSession(siteId: string): Promise<Session> {
  const { rows } = await pool.query<Session>(
    `INSERT INTO sessions (site_id) VALUES ($1) RETURNING *`,
    [siteId]
  );
  return rows[0];
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { rows } = await pool.query<Session>(
    'SELECT * FROM sessions WHERE id = $1 LIMIT 1',
    [sessionId]
  );
  return rows[0] ?? null;
}

export async function incrementMessageCount(sessionId: string): Promise<number> {
  const { rows } = await pool.query<{ message_count: number }>(
    `UPDATE sessions
     SET message_count = message_count + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING message_count`,
    [sessionId]
  );
  return rows[0]?.message_count ?? 0;
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'qualified' | 'abandoned'
): Promise<void> {
  await pool.query(
    'UPDATE sessions SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, sessionId]
  );
}

/**
 * Mescla os dados coletados no acumulador da sessão.
 * Apenas campos não-nulos e não-vazios são gravados — preserva dados anteriores.
 */
export async function mergeCollectedData(
  sessionId: string,
  newData: Record<string, string | null>
): Promise<void> {
  // Remove campos nulos/vazios antes de mesclar
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(newData)) {
    if (v !== null && v !== undefined && v.toString().trim() !== '') {
      clean[k] = v.toString().trim();
    }
  }
  if (Object.keys(clean).length === 0) return;

  // jsonb_strip_nulls + || mescla objetos JSONB no PostgreSQL
  await pool.query(
    `UPDATE sessions
     SET collected_data = collected_data || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(clean), sessionId]
  );
}

export async function getCollectedData(
  sessionId: string
): Promise<Record<string, string | null>> {
  const { rows } = await pool.query<{ collected_data: Record<string, string> }>(
    'SELECT collected_data FROM sessions WHERE id = $1',
    [sessionId]
  );
  return rows[0]?.collected_data ?? {};
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'bot',
  content: string
): Promise<void> {
  await pool.query(
    'INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, role, content]
  );
}

export async function getMessageHistory(sessionId: string): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
  return rows;
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function saveLead(
  sessionId: string,
  data: CollectedData,
  siteSource: string,
  whatsappUrl: string
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO leads
       (session_id, name, project_type, client_type, cnpj, contact, budget, site_source, whatsapp_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      sessionId,
      data.name,
      data.projectType,
      data.clientType,
      data.cnpj,
      data.contact,
      data.budget,
      siteSource,
      whatsappUrl,
    ]
  );
  return rows[0].id;
}

export async function markLeadNotified(leadId: string): Promise<void> {
  await pool.query(
    'UPDATE leads SET notified_at = NOW() WHERE id = $1',
    [leadId]
  );
}

export async function getSiteBySessionId(sessionId: string): Promise<Site | null> {
  const { rows } = await pool.query<Site>(
    `SELECT s.* FROM sites s
     JOIN sessions ss ON ss.site_id = s.id
     WHERE ss.id = $1 LIMIT 1`,
    [sessionId]
  );
  return rows[0] ?? null;
}
