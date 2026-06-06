import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/adminAuth';
import { listLeads, exportLeads, type LeadFilters } from '../../services/adminDatabase';

// Cabeçalhos do CSV exportado
const CSV_HEADERS = [
  'ID', 'Nome', 'Contato', 'Tipo de projeto', 'PF/PJ', 'CNPJ',
  'Orçamento', 'Site', 'Domínio', 'Notificado em', 'Criado em',
];

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function formatCSVDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR');
}

export async function adminLeadsRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAdmin(app) };

  // GET /api/admin/leads — lista paginada com filtros
  app.get('/api/admin/leads', auth, async (request, reply) => {
    const q = request.query as Record<string, string>;

    const filters: LeadFilters = {
      siteId:   q.siteId   || undefined,
      dateFrom: q.dateFrom || undefined,
      dateTo:   q.dateTo   || undefined,
      search:   q.search   || undefined,
      page:     q.page  ? parseInt(q.page)  : 1,
      limit:    q.limit ? parseInt(q.limit) : 20,
    };

    const { leads, total } = await listLeads(filters);
    return reply.send({ leads, total, page: filters.page, limit: filters.limit });
  });

  // GET /api/admin/leads/export — download CSV
  app.get('/api/admin/leads/export', auth, async (request, reply) => {
    const q = request.query as Record<string, string>;

    const filters: LeadFilters = {
      siteId:   q.siteId   || undefined,
      dateFrom: q.dateFrom || undefined,
      dateTo:   q.dateTo   || undefined,
      search:   q.search   || undefined,
    };

    const leads = await exportLeads(filters);

    const rows = leads.map(l => [
      l.id,
      l.name,
      l.contact,
      l.project_type,
      l.client_type,
      l.cnpj,
      l.budget,
      l.site_name,
      l.site_domain,
      formatCSVDate(l.notified_at),
      formatCSVDate(l.created_at),
    ].map(escapeCSV).join(','));

    const csv = [CSV_HEADERS.join(','), ...rows].join('\n');
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send('﻿' + csv);   // BOM para Excel abrir UTF-8 corretamente
  });
}
