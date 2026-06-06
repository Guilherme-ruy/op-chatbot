import { randomBytes } from 'crypto';
import { pool } from '../db/pool';
import type { AdminUser, SiteWithStats, Site, Lead, SiteField } from '../types';

// ── Leads ─────────────────────────────────────────────────────────────────────

export interface LeadWithSite extends Lead {
  site_name: string;
  site_domain: string;
}

export interface LeadFilters {
  siteId?:   string;
  dateFrom?: string;
  dateTo?:   string;
  search?:   string;
  page?:     number;
  limit?:    number;
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
  limit_message?: string | null;
}): Promise<Site> {
  const token = generateSiteToken();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<Site>(
      `INSERT INTO sites (name, domain, token, bot_name, bot_avatar_url, whatsapp_number, plan_name, monthly_session_limit, limit_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.name, data.domain, token, data.bot_name,
        data.bot_avatar_url ?? null, data.whatsapp_number ?? null,
        data.plan_name ?? null, data.monthly_session_limit ?? null,
        data.limit_message ?? null,
      ]
    );
    const site = rows[0];
    // Insere campos padrão para o novo site
    for (const f of DEFAULT_SITE_FIELDS) {
      await client.query(
        `INSERT INTO site_fields (site_id, key, label, hint, required, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [site.id, f.key, f.label, f.hint, f.required, f.sort_order]
      );
    }
    await client.query('COMMIT');
    return site;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
    limit_message: string | null;
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
  if ('limit_message'          in data)           { fields.push(`limit_message = $${idx++}`);           values.push(data.limit_message); }
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

// ── Site fields (campos de coleta configuráveis) ──────────────────────────────

/** Campos padrão inseridos ao criar um site */
export const DEFAULT_SITE_FIELDS: Omit<SiteField, 'id' | 'site_id' | 'created_at'>[] = [
  { key: 'name',        label: 'Nome do visitante',         hint: null,                                                                                                                        required: true,  sort_order: 0 },
  { key: 'service',     label: 'Tipo de serviço',           hint: 'Pergunte qual tipo de serviço o visitante precisa. Exemplos: site, sistema, hospedagem, outro. Aceite a resposta como está.', required: true,  sort_order: 1 },
  { key: 'client_type', label: 'Pessoa física ou empresa',  hint: 'Pergunte se é pessoa física ou empresa. Se pessoa física retorne pf, se empresa retorne pj.',                              required: false, sort_order: 2 },
  { key: 'cnpj',        label: 'CNPJ',                      hint: 'Se o cliente informou ser empresa, pergunte o CNPJ para personalizar a proposta. É opcional — se não quiser informar, siga em frente.', required: false, sort_order: 3 },
  { key: 'contact',     label: 'WhatsApp ou e-mail',        hint: null,                                                                                                                        required: true,  sort_order: 4 },
];

export async function listSiteFields(siteId: string): Promise<SiteField[]> {
  const { rows } = await pool.query<SiteField>(
    'SELECT * FROM site_fields WHERE site_id = $1 ORDER BY sort_order ASC, created_at ASC',
    [siteId]
  );
  return rows;
}

export async function createSiteField(
  siteId: string,
  data: { key: string; label: string; hint?: string | null; required?: boolean; sort_order?: number }
): Promise<SiteField> {
  const { rows } = await pool.query<SiteField>(
    `INSERT INTO site_fields (site_id, key, label, hint, required, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [siteId, data.key, data.label, data.hint ?? null, data.required ?? true, data.sort_order ?? 0]
  );
  return rows[0];
}

export async function updateSiteField(
  id: string,
  siteId: string,
  data: Partial<{ label: string; hint: string | null; required: boolean; sort_order: number }>
): Promise<SiteField | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.label      !== undefined) { fields.push(`label = $${idx++}`);      values.push(data.label); }
  if ('hint'          in data)       { fields.push(`hint = $${idx++}`);        values.push(data.hint); }
  if (data.required   !== undefined) { fields.push(`required = $${idx++}`);   values.push(data.required); }
  if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sort_order); }

  if (fields.length === 0) {
    const { rows } = await pool.query<SiteField>(
      'SELECT * FROM site_fields WHERE id = $1 AND site_id = $2',
      [id, siteId]
    );
    return rows[0] ?? null;
  }

  values.push(id, siteId);
  const { rows } = await pool.query<SiteField>(
    `UPDATE site_fields SET ${fields.join(', ')} WHERE id = $${idx++} AND site_id = $${idx++} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteSiteField(id: string, siteId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM site_fields WHERE id = $1 AND site_id = $2',
    [id, siteId]
  );
  return (rowCount ?? 0) > 0;
}

/** Reordena campos: recebe array de IDs na nova ordem */
export async function reorderSiteFields(
  siteId: string,
  orderedIds: string[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'UPDATE site_fields SET sort_order = $1 WHERE id = $2 AND site_id = $3',
        [i, orderedIds[i], siteId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Restaura campos padrão: apaga tudo e reinicia com os defaults */
export async function resetSiteFields(siteId: string): Promise<SiteField[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM site_fields WHERE site_id = $1', [siteId]);
    const inserted: SiteField[] = [];
    for (const f of DEFAULT_SITE_FIELDS) {
      const { rows } = await client.query<SiteField>(
        `INSERT INTO site_fields (site_id, key, label, hint, required, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [siteId, f.key, f.label, f.hint, f.required, f.sort_order]
      );
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
  // Identidade — null quando a visão é de todos os sites
  site: Site | null;
  // Uso mensal atual (sempre mês corrente — para o card "Uso mensal")
  sessions_this_month:   number;
  qualified_this_month:  number;
  // Acumulado total (sempre histórico completo — para "Totais históricos")
  total_sessions_all:    number;
  total_leads_all:       number;
  // Métricas do período selecionado (afetadas pelo filtro de data)
  leads_in_period:          number;
  avg_messages_per_session: number;
  abandonment_rate:         number;   // % de sessões abandonadas no período
  // Séries temporais do período (dia a dia ou mês a mês se "todo período")
  sessions_by_day: { date: string; sessions: number; leads: number }[];
  // Distribuições do período
  leads_by_project: { type: string; count: number }[];
  peak_hours:       { hour: number; count: number }[];
  // Últimos leads (sempre os 5 mais recentes, independente do período)
  recent_leads: {
    id: string; name: string | null; contact: string | null;
    project_type: string | null; whatsapp_url: string | null; created_at: Date;
    site_name?: string; // presente apenas na visão de todos os sites
  }[];
}

// days: 7 | 30 | 90 | 0 (0 = todo o período, sem filtro de data)
export async function getSiteDetailStats(siteId: string, days = 30): Promise<SiteDetailStats | null> {
  const site = await getSiteById(siteId);
  if (!site) return null;

  // Cláusula de filtro de data reutilizável (segura — days é sempre um número inteiro validado)
  const periodJoin   = days > 0 ? `AND ss.created_at >= NOW() - INTERVAL '${days} days'` : '';
  const periodSimple = days > 0 ? `AND created_at    >= NOW() - INTERVAL '${days} days'` : '';

  const [
    monthlyRes, allTimeRes, periodRes,
    byDayRes, byProjectRes, peakHoursRes, recentLeadsRes,
  ] = await Promise.all([

    // ── Mês corrente (card "Uso mensal" — nunca filtrado por período) ──────────
    pool.query<{ sessions_this_month: number; qualified_this_month: number }>(`
      SELECT
        COUNT(DISTINCT ss.id)::int                                         AS sessions_this_month,
        COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'qualified')::int  AS qualified_this_month
      FROM sessions ss
      WHERE ss.site_id = $1
        AND DATE_TRUNC('month', ss.created_at) = DATE_TRUNC('month', NOW())
    `, [siteId]),

    // ── Totais históricos (bloco "Totais históricos" — nunca filtrado) ─────────
    pool.query<{ total_sessions_all: number; total_leads_all: number }>(`
      SELECT
        COUNT(DISTINCT ss.id)::int AS total_sessions_all,
        COUNT(DISTINCT l.id)::int  AS total_leads_all
      FROM sessions ss
      LEFT JOIN leads l ON l.session_id = ss.id
      WHERE ss.site_id = $1
    `, [siteId]),

    // ── Métricas do período selecionado (KPI cards) ───────────────────────────
    pool.query<{ leads_in_period: number; avg_messages: number; abandonment_rate: number }>(`
      SELECT
        COUNT(DISTINCT l.id)::int                                             AS leads_in_period,
        ROUND(AVG(ss.message_count), 1)::float                               AS avg_messages,
        ROUND(
          100.0 * COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'abandoned')
          / NULLIF(COUNT(DISTINCT ss.id), 0), 1
        )::float                                                              AS abandonment_rate
      FROM sessions ss
      LEFT JOIN leads l ON l.session_id = ss.id
      WHERE ss.site_id = $1 ${periodJoin}
    `, [siteId]),

    // ── Gráfico de atividade — dia a dia (períodos curtos) ou mês a mês (todo período) ──
    days > 0
      ? pool.query<{ date: string; sessions: number; leads: number }>(`
          SELECT
            DATE(ss.created_at)::text    AS date,
            COUNT(DISTINCT ss.id)::int   AS sessions,
            COUNT(DISTINCT l.id)::int    AS leads
          FROM sessions ss
          LEFT JOIN leads l ON l.session_id = ss.id
          WHERE ss.site_id = $1
            AND ss.created_at >= NOW() - INTERVAL '${days} days'
          GROUP BY DATE(ss.created_at)
          ORDER BY date
        `, [siteId])
      : pool.query<{ date: string; sessions: number; leads: number }>(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', ss.created_at), 'YYYY-MM') AS date,
            COUNT(DISTINCT ss.id)::int                              AS sessions,
            COUNT(DISTINCT l.id)::int                              AS leads
          FROM sessions ss
          LEFT JOIN leads l ON l.session_id = ss.id
          WHERE ss.site_id = $1
          GROUP BY DATE_TRUNC('month', ss.created_at)
          ORDER BY date
        `, [siteId]),

    // ── Distribuição por tipo de projeto (período) ────────────────────────────
    pool.query<{ type: string; count: number }>(`
      SELECT COALESCE(l.project_type, 'não informado') AS type, COUNT(*)::int AS count
      FROM leads l
      JOIN sessions ss ON l.session_id = ss.id
      WHERE ss.site_id = $1 ${periodJoin}
      GROUP BY l.project_type
      ORDER BY count DESC
    `, [siteId]),

    // ── Horários de pico (período) ────────────────────────────────────────────
    pool.query<{ hour: number; count: number }>(`
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
      FROM sessions
      WHERE site_id = $1 ${periodSimple}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [siteId]),

    // ── Últimos 5 leads (sempre os mais recentes, sem filtro de período) ──────
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
  const p = periodRes.rows[0]!;

  return {
    site,
    sessions_this_month:      m.sessions_this_month  ?? 0,
    qualified_this_month:     m.qualified_this_month ?? 0,
    leads_in_period:          p.leads_in_period       ?? 0,
    total_sessions_all:       a.total_sessions_all    ?? 0,
    total_leads_all:          a.total_leads_all       ?? 0,
    avg_messages_per_session: p.avg_messages          ?? 0,
    abandonment_rate:         p.abandonment_rate      ?? 0,
    sessions_by_day:          byDayRes.rows,
    leads_by_project:         byProjectRes.rows,
    peak_hours:               peakHoursRes.rows,
    recent_leads:             recentLeadsRes.rows,
  };
}

// Visão agregada de todos os sites — mesmo formato de SiteDetailStats, site = null
export async function getAllSitesStats(days = 30): Promise<SiteDetailStats> {
  const pJoin   = days > 0 ? `AND ss.created_at >= NOW() - INTERVAL '${days} days'` : '';
  const pSimple = days > 0 ? `AND created_at    >= NOW() - INTERVAL '${days} days'` : '';

  const [monthlyRes, allTimeRes, periodRes, byDayRes, byProjectRes, peakHoursRes, recentLeadsRes] =
    await Promise.all([

      pool.query<{ sessions_this_month: number; qualified_this_month: number }>(`
        SELECT
          COUNT(DISTINCT id)::int                                        AS sessions_this_month,
          COUNT(DISTINCT id) FILTER (WHERE status = 'qualified')::int   AS qualified_this_month
        FROM sessions
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `),

      pool.query<{ total_sessions_all: number; total_leads_all: number }>(`
        SELECT
          COUNT(DISTINCT ss.id)::int AS total_sessions_all,
          COUNT(DISTINCT l.id)::int  AS total_leads_all
        FROM sessions ss
        LEFT JOIN leads l ON l.session_id = ss.id
      `),

      pool.query<{ leads_in_period: number; avg_messages: number; abandonment_rate: number }>(`
        SELECT
          COUNT(DISTINCT l.id)::int                                             AS leads_in_period,
          ROUND(AVG(ss.message_count), 1)::float                               AS avg_messages,
          ROUND(
            100.0 * COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'abandoned')
            / NULLIF(COUNT(DISTINCT ss.id), 0), 1
          )::float                                                              AS abandonment_rate
        FROM sessions ss
        LEFT JOIN leads l ON l.session_id = ss.id
        WHERE 1=1 ${pJoin}
      `),

      days > 0
        ? pool.query<{ date: string; sessions: number; leads: number }>(`
            SELECT
              DATE(ss.created_at)::text  AS date,
              COUNT(DISTINCT ss.id)::int AS sessions,
              COUNT(DISTINCT l.id)::int  AS leads
            FROM sessions ss
            LEFT JOIN leads l ON l.session_id = ss.id
            WHERE ss.created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(ss.created_at)
            ORDER BY date
          `)
        : pool.query<{ date: string; sessions: number; leads: number }>(`
            SELECT
              TO_CHAR(DATE_TRUNC('month', ss.created_at), 'YYYY-MM') AS date,
              COUNT(DISTINCT ss.id)::int                              AS sessions,
              COUNT(DISTINCT l.id)::int                              AS leads
            FROM sessions ss
            LEFT JOIN leads l ON l.session_id = ss.id
            GROUP BY DATE_TRUNC('month', ss.created_at)
            ORDER BY date
          `),

      pool.query<{ type: string; count: number }>(`
        SELECT COALESCE(l.project_type, 'não informado') AS type, COUNT(*)::int AS count
        FROM leads l
        JOIN sessions ss ON l.session_id = ss.id
        WHERE 1=1 ${pJoin}
        GROUP BY l.project_type
        ORDER BY count DESC
      `),

      pool.query<{ hour: number; count: number }>(`
        SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
        FROM sessions
        WHERE 1=1 ${pSimple}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `),

      pool.query<{
        id: string; name: string | null; contact: string | null;
        project_type: string | null; whatsapp_url: string | null;
        created_at: Date; site_name: string;
      }>(`
        SELECT l.id, l.name, l.contact, l.project_type, l.whatsapp_url, l.created_at,
               s.name AS site_name
        FROM leads l
        JOIN sessions ss ON l.session_id = ss.id
        JOIN sites    s  ON ss.site_id   = s.id
        ORDER BY l.created_at DESC
        LIMIT 5
      `),
    ]);

  const m = monthlyRes.rows[0]!;
  const a = allTimeRes.rows[0]!;
  const p = periodRes.rows[0]!;

  return {
    site:                     null,
    sessions_this_month:      m.sessions_this_month  ?? 0,
    qualified_this_month:     m.qualified_this_month ?? 0,
    leads_in_period:          p.leads_in_period       ?? 0,
    total_sessions_all:       a.total_sessions_all    ?? 0,
    total_leads_all:          a.total_leads_all       ?? 0,
    avg_messages_per_session: p.avg_messages          ?? 0,
    abandonment_rate:         p.abandonment_rate      ?? 0,
    sessions_by_day:          byDayRes.rows,
    leads_by_project:         byProjectRes.rows,
    peak_hours:               peakHoursRes.rows,
    recent_leads:             recentLeadsRes.rows,
  };
}
