import { randomBytes } from 'crypto';
import { pool } from '../db/pool';
import type { AdminUser, SiteWithStats, Site, Lead } from '../types';

// ── Leads ─────────────────────────────────────────────────────────────────────

export interface LeadWithSite extends Lead {
  site_name: string;
  site_domain: string;
}

export interface LeadFilters {
  siteId?:      string;
  dateFrom?:    string;
  dateTo?:      string;
  search?:      string;
  projectType?: string;
  page?:        number;
  limit?:       number;
}

function buildLeadsQuery(filters: LeadFilters, forExport = false) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.siteId) {
    conditions.push(`ss.site_id = $${idx++}`);
    values.push(filters.siteId);
  }
  if (filters.dateFrom) {
    conditions.push(`l.created_at >= $${idx++}`);
    values.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`l.created_at <= $${idx++}::date + interval '1 day'`);
    values.push(filters.dateTo);
  }
  if (filters.search) {
    conditions.push(`(l.name ILIKE $${idx} OR l.contact ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.projectType) {
    conditions.push(`l.project_type = $${idx++}`);
    values.push(filters.projectType);
  }

  const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  const base = `
    FROM leads l
    JOIN sessions ss ON l.session_id = ss.id
    JOIN sites    s  ON ss.site_id   = s.id
    WHERE s.deleted_at IS NULL
    ${where}
  `;

  if (forExport) {
    return { sql: `SELECT l.*, s.name AS site_name, s.domain AS site_domain ${base} ORDER BY l.created_at DESC`, values };
  }

  const limit  = filters.limit  ?? 20;
  const offset = ((filters.page ?? 1) - 1) * limit;
  values.push(limit, offset);

  return {
    sql:      `SELECT l.*, s.name AS site_name, s.domain AS site_domain ${base} ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    countSql: `SELECT COUNT(*)::int AS total ${base}`,
    values,
    countValues: values.slice(0, -2),  // sem limit/offset
  };
}

export async function listLeads(
  filters: LeadFilters
): Promise<{ leads: LeadWithSite[]; total: number }> {
  const { sql, countSql, values, countValues } = buildLeadsQuery(filters) as Required<ReturnType<typeof buildLeadsQuery>>;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<LeadWithSite>(sql, values),
    pool.query<{ total: number }>(countSql!, countValues),
  ]);
  return { leads: rows, total: countRows[0]?.total ?? 0 };
}

export async function exportLeads(filters: LeadFilters): Promise<LeadWithSite[]> {
  const { sql, values } = buildLeadsQuery(filters, true);
  const { rows } = await pool.query<LeadWithSite>(sql, values);
  return rows;
}

// ── Sessões ───────────────────────────────────────────────────────────────────

export interface SessionWithSite {
  id: string;
  site_id: string;
  site_name: string;
  site_domain: string;
  status: 'active' | 'qualified' | 'abandoned';
  message_count: number;
  collected_data: Record<string, string | null>;
  created_at: Date;
  updated_at: Date;
}

export interface SessionFilters {
  siteId?:   string;
  status?:   string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}

export async function listSessions(
  filters: SessionFilters
): Promise<{ sessions: SessionWithSite[]; total: number }> {
  const conditions: string[] = ['s.deleted_at IS NULL'];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.siteId)   { conditions.push(`ss.site_id = $${idx++}`);               values.push(filters.siteId); }
  if (filters.status)   { conditions.push(`ss.status = $${idx++}`);                values.push(filters.status); }
  if (filters.dateFrom) { conditions.push(`ss.created_at >= $${idx++}`);           values.push(filters.dateFrom); }
  if (filters.dateTo)   { conditions.push(`ss.created_at <= $${idx++}::date + interval '1 day'`); values.push(filters.dateTo); }

  const where = conditions.join(' AND ');
  const base  = `FROM sessions ss JOIN sites s ON ss.site_id = s.id WHERE ${where}`;

  const limit  = filters.limit  ?? 25;
  const offset = ((filters.page ?? 1) - 1) * limit;

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<SessionWithSite>(
      `SELECT ss.*, s.name AS site_name, s.domain AS site_domain ${base}
       ORDER BY ss.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    ),
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total ${base}`,
      values
    ),
  ]);

  return { sessions: rows, total: countRows[0]?.total ?? 0 };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_sites_active: number;
  total_sessions_30d: number;
  total_qualified_30d: number;
  total_leads_30d: number;
  qualification_rate: number;
  leads_by_day: { date: string; count: number }[];
  leads_by_project: { type: string; count: number }[];
  top_sites: { name: string; domain: string; leads: number; sessions: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    sitesRes, sessions30Res, qualified30Res, leads30Res,
    byDayRes, byProjectRes, topSitesRes,
  ] = await Promise.all([
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM sites WHERE active = true AND deleted_at IS NULL
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM sessions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM sessions
      WHERE status = 'qualified' AND created_at >= NOW() - INTERVAL '30 days'
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM leads
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
    pool.query<{ date: string; count: number }>(`
      SELECT DATE(created_at)::text AS date, COUNT(*)::int AS count
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `),
    pool.query<{ type: string; count: number }>(`
      SELECT COALESCE(project_type, 'não informado') AS type, COUNT(*)::int AS count
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY project_type
      ORDER BY count DESC
    `),
    pool.query<{ name: string; domain: string; leads: number; sessions: number }>(`
      SELECT s.name, s.domain,
        COUNT(DISTINCT l.id)::int  AS leads,
        COUNT(DISTINCT ss.id)::int AS sessions
      FROM sites s
      LEFT JOIN sessions ss ON ss.site_id = s.id AND ss.created_at >= NOW() - INTERVAL '30 days'
      LEFT JOIN leads    l  ON l.session_id = ss.id
      WHERE s.deleted_at IS NULL AND s.active = true
      GROUP BY s.id
      ORDER BY leads DESC
      LIMIT 5
    `),
  ]);

  const total30 = sessions30Res.rows[0]?.count ?? 0;
  const qualified30 = qualified30Res.rows[0]?.count ?? 0;

  return {
    total_sites_active:  sitesRes.rows[0]?.count     ?? 0,
    total_sessions_30d:  total30,
    total_qualified_30d: qualified30,
    total_leads_30d:     leads30Res.rows[0]?.count   ?? 0,
    qualification_rate:  total30 > 0 ? Math.round((qualified30 / total30) * 100) : 0,
    leads_by_day:        byDayRes.rows,
    leads_by_project:    byProjectRes.rows,
    top_sites:           topSitesRes.rows,
  };
}

export async function getSessionMessages(sessionId: string) {
  const { rows } = await pool.query(
    `SELECT id, role, content, created_at
     FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows;
}

// ── Admin users ───────────────────────────────────────────────────────────────

export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  const { rows } = await pool.query<AdminUser>(
    'SELECT * FROM admin_users WHERE email = $1 LIMIT 1',
    [email]
  );
  return rows[0] ?? null;
}

export async function updateAdminLastLogin(id: string): Promise<void> {
  await pool.query(
    'UPDATE admin_users SET last_login_at = NOW() WHERE id = $1',
    [id]
  );
}

// ── Sites (clientes) ──────────────────────────────────────────────────────────

const SITE_STATS_QUERY = (whereClause: string) => `
  SELECT
    s.*,
    COUNT(DISTINCT ss.id)::int                                        AS total_sessions,
    COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'qualified')::int AS qualified_sessions,
    COUNT(DISTINCT l.id)::int                                         AS total_leads
  FROM sites s
  LEFT JOIN sessions ss ON ss.site_id = s.id
  LEFT JOIN leads    l  ON l.session_id = ss.id
  WHERE ${whereClause}
  GROUP BY s.id
  ORDER BY s.created_at DESC
`;

export async function listSites(): Promise<SiteWithStats[]> {
  const { rows } = await pool.query<SiteWithStats>(SITE_STATS_QUERY('s.deleted_at IS NULL'));
  return rows;
}

export async function listDeletedSites(): Promise<SiteWithStats[]> {
  const { rows } = await pool.query<SiteWithStats>(SITE_STATS_QUERY('s.deleted_at IS NOT NULL'));
  return rows;
}

export async function getSiteById(id: string): Promise<Site | null> {
  const { rows } = await pool.query<Site>(
    'SELECT * FROM sites WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

export async function getSiteByIdIncludeDeleted(id: string): Promise<Site | null> {
  const { rows } = await pool.query<Site>(
    'SELECT * FROM sites WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

export function generateSiteToken(): string {
  return `chatbot_${randomBytes(24).toString('hex')}`;
}

export async function createSite(data: {
  name: string;
  domain: string;
  bot_name: string;
  bot_avatar_url?: string | null;
  whatsapp_number?: string | null;
  plan_name?: string | null;
  monthly_session_limit?: number | null;
}): Promise<Site> {
  const token = generateSiteToken();
  const { rows } = await pool.query<Site>(
    `INSERT INTO sites (name, domain, token, bot_name, bot_avatar_url, whatsapp_number, plan_name, monthly_session_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.name, data.domain, token, data.bot_name,
      data.bot_avatar_url ?? null, data.whatsapp_number ?? null,
      data.plan_name ?? null, data.monthly_session_limit ?? null,
    ]
  );
  return rows[0];
}

export async function updateSite(
  id: string,
  data: Partial<{
    name: string;
    domain: string;
    bot_name: string;
    bot_avatar_url: string | null;
    whatsapp_number: string | null;
    plan_name: string | null;
    monthly_session_limit: number | null;
    active: boolean;
  }>
): Promise<Site | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name                    !== undefined) { fields.push(`name = $${idx++}`);                    values.push(data.name); }
  if (data.domain                  !== undefined) { fields.push(`domain = $${idx++}`);                  values.push(data.domain); }
  if (data.bot_name                !== undefined) { fields.push(`bot_name = $${idx++}`);                values.push(data.bot_name); }
  if ('bot_avatar_url'         in data)           { fields.push(`bot_avatar_url = $${idx++}`);          values.push(data.bot_avatar_url); }
  if ('whatsapp_number'        in data)           { fields.push(`whatsapp_number = $${idx++}`);         values.push(data.whatsapp_number); }
  if ('plan_name'              in data)           { fields.push(`plan_name = $${idx++}`);               values.push(data.plan_name); }
  if ('monthly_session_limit'  in data)           { fields.push(`monthly_session_limit = $${idx++}`);   values.push(data.monthly_session_limit); }
  if (data.active                  !== undefined) { fields.push(`active = $${idx++}`);                  values.push(data.active); }

  if (fields.length === 0) return getSiteById(id);

  values.push(id);
  const { rows } = await pool.query<Site>(
    `UPDATE sites SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function softDeleteSite(id: string): Promise<void> {
  await pool.query(
    `UPDATE sites SET deleted_at = NOW(), active = false WHERE id = $1`,
    [id]
  );
}

export async function restoreSite(id: string): Promise<Site | null> {
  const { rows } = await pool.query<Site>(
    `UPDATE sites SET deleted_at = NULL, active = true WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

export async function regenerateSiteToken(id: string): Promise<string | null> {
  const token = generateSiteToken();
  const { rows } = await pool.query<{ token: string }>(
    `UPDATE sites SET token = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING token`,
    [token, id]
  );
  return rows[0]?.token ?? null;
}

// ── Stats por site ────────────────────────────────────────────────────────────

export interface SiteDetailStats {
  // Identidade
  site: Site;
  // Uso mensal
  sessions_this_month:   number;
  qualified_this_month:  number;
  leads_this_month:      number;
  // Acumulado total
  total_sessions_all:    number;
  total_leads_all:       number;
  // Métricas qualitativas
  avg_messages_per_session: number;
  abandonment_rate:         number;   // % de sessões abandonadas
  qualification_rate:       number;   // % de sessões qualificadas
  // Séries temporais (últimos 30 dias)
  sessions_by_day: { date: string; sessions: number; leads: number }[];
  // Distribuições
  leads_by_project: { type: string; count: number }[];
  peak_hours:       { hour: number; count: number }[];
  // Últimos registros
  recent_leads: {
    id: string; name: string | null; contact: string | null;
    project_type: string | null; whatsapp_url: string | null; created_at: Date;
  }[];
}

export async function getSiteDetailStats(siteId: string): Promise<SiteDetailStats | null> {
  const site = await getSiteById(siteId);
  if (!site) return null;

  const [
    monthlyRes, allTimeRes, avgMsgRes,
    byDayRes, byProjectRes, peakHoursRes, recentLeadsRes,
  ] = await Promise.all([
    // Uso do mês atual
    pool.query<{
      sessions_this_month: number; qualified_this_month: number; leads_this_month: number;
    }>(`
      SELECT
        COUNT(DISTINCT ss.id)::int                                          AS sessions_this_month,
        COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'qualified')::int   AS qualified_this_month,
        COUNT(DISTINCT l.id)::int                                           AS leads_this_month
      FROM sessions ss
      LEFT JOIN leads l ON l.session_id = ss.id
      WHERE ss.site_id = $1
        AND DATE_TRUNC('month', ss.created_at) = DATE_TRUNC('month', NOW())
    `, [siteId]),

    // Totais históricos + métricas de qualidade
    pool.query<{
      total_sessions_all: number; total_leads_all: number;
      avg_messages: number; abandonment_rate: number;
    }>(`
      SELECT
        COUNT(DISTINCT ss.id)::int                                            AS total_sessions_all,
        COUNT(DISTINCT l.id)::int                                             AS total_leads_all,
        ROUND(AVG(ss.message_count), 1)::float                               AS avg_messages,
        ROUND(
          100.0 * COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'abandoned')
          / NULLIF(COUNT(DISTINCT ss.id), 0), 1
        )::float                                                              AS abandonment_rate
      FROM sessions ss
      LEFT JOIN leads l ON l.session_id = ss.id
      WHERE ss.site_id = $1
    `, [siteId]),

    // Média de mensagens separada (para segurança)
    pool.query<{ avg: number }>(`
      SELECT ROUND(AVG(message_count), 1)::float AS avg FROM sessions WHERE site_id = $1
    `, [siteId]),

    // Sessões e leads por dia (últimos 30 dias)
    pool.query<{ date: string; sessions: number; leads: number }>(`
      SELECT
        DATE(ss.created_at)::text                        AS date,
        COUNT(DISTINCT ss.id)::int                       AS sessions,
        COUNT(DISTINCT l.id)::int                        AS leads
      FROM sessions ss
      LEFT JOIN leads l ON l.session_id = ss.id
      WHERE ss.site_id = $1
        AND ss.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(ss.created_at)
      ORDER BY date
    `, [siteId]),

    // Distribuição por tipo de projeto
    pool.query<{ type: string; count: number }>(`
      SELECT COALESCE(l.project_type, 'não informado') AS type, COUNT(*)::int AS count
      FROM leads l
      JOIN sessions ss ON l.session_id = ss.id
      WHERE ss.site_id = $1
      GROUP BY l.project_type
      ORDER BY count DESC
    `, [siteId]),

    // Horários de pico (hora do dia com mais sessões)
    pool.query<{ hour: number; count: number }>(`
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
      FROM sessions
      WHERE site_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [siteId]),

    // Últimos 5 leads
    pool.query<{
      id: string; name: string | null; contact: string | null;
      project_type: string | null; whatsapp_url: string | null; created_at: Date;
    }>(`
      SELECT l.id, l.name, l.contact, l.project_type, l.whatsapp_url, l.created_at
      FROM leads l
      JOIN sessions ss ON l.session_id = ss.id
      WHERE ss.site_id = $1
      ORDER BY l.created_at DESC
      LIMIT 5
    `, [siteId]),
  ]);

  const m = monthlyRes.rows[0]!;
  const a = allTimeRes.rows[0]!;

  const sessionsThisMonth  = m.sessions_this_month  ?? 0;
  const qualifiedThisMonth = m.qualified_this_month ?? 0;

  return {
    site,
    sessions_this_month:      sessionsThisMonth,
    qualified_this_month:     qualifiedThisMonth,
    leads_this_month:         m.leads_this_month ?? 0,
    total_sessions_all:       a.total_sessions_all ?? 0,
    total_leads_all:          a.total_leads_all ?? 0,
    avg_messages_per_session: avgMsgRes.rows[0]?.avg ?? 0,
    abandonment_rate:         a.abandonment_rate ?? 0,
    qualification_rate:       sessionsThisMonth > 0
      ? Math.round((qualifiedThisMonth / sessionsThisMonth) * 100)
      : 0,
    sessions_by_day:  byDayRes.rows,
    leads_by_project: byProjectRes.rows,
    peak_hours:       peakHoursRes.rows,
    recent_leads:     recentLeadsRes.rows,
  };
}
