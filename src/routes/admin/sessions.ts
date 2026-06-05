import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/adminAuth';
import { listSessions, getSessionMessages, type SessionFilters } from '../../services/adminDatabase';

export async function adminSessionsRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAdmin(app) };

  // GET /api/admin/sessions — lista paginada com filtros
  app.get('/api/admin/sessions', auth, async (request, reply) => {
    const q = request.query as Record<string, string>;

    const filters: SessionFilters = {
      siteId:   q.siteId   || undefined,
      status:   q.status   || undefined,
      dateFrom: q.dateFrom || undefined,
      dateTo:   q.dateTo   || undefined,
      page:     q.page  ? parseInt(q.page)  : 1,
      limit:    q.limit ? parseInt(q.limit) : 25,
    };

    const { sessions, total } = await listSessions(filters);
    return reply.send({ sessions, total, page: filters.page, limit: filters.limit });
  });

  // GET /api/admin/sessions/:id/messages — histórico completo de uma conversa
  app.get('/api/admin/sessions/:id/messages', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const messages = await getSessionMessages(id);
    return reply.send(messages);
  });
}
