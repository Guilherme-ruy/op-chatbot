import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/adminAuth';
import {
  listSites,
  listDeletedSites,
  createSite,
  updateSite,
  softDeleteSite,
  restoreSite,
  regenerateSiteToken,
  getSiteById,
  getSiteByIdIncludeDeleted,
  getSiteDetailStats,
} from '../../services/adminDatabase';

export async function adminSitesRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAdmin(app) };

  // GET /api/admin/sites — lista clientes ativos com stats
  app.get('/api/admin/sites', auth, async (_req, reply) => {
    const sites = await listSites();
    return reply.send(sites);
  });

  // GET /api/admin/sites/deleted — lista clientes soft-deletados
  app.get('/api/admin/sites/deleted', auth, async (_req, reply) => {
    const sites = await listDeletedSites();
    return reply.send(sites);
  });

  // POST /api/admin/sites — cria novo cliente
  app.post('/api/admin/sites', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'domain', 'bot_name'],
        properties: {
          name:          { type: 'string', minLength: 1 },
          domain:        { type: 'string', minLength: 1 },
          bot_name:      { type: 'string', minLength: 1 },
          bot_avatar_url: { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      domain: string;
      bot_name: string;
      bot_avatar_url?: string | null;
      whatsapp_number?: string | null;
      plan_name?: string | null;
      monthly_session_limit?: number | null;
    };
    try {
      const site = await createSite(body);
      return reply.code(201).send(site);
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'Domínio já cadastrado.' });
      }
      throw err;
    }
  });

  // PATCH /api/admin/sites/:id — atualiza campos do cliente
  app.patch('/api/admin/sites/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowed = ['name', 'domain', 'bot_name', 'bot_avatar_url', 'whatsapp_number', 'plan_name', 'monthly_session_limit', 'active'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    try {
      const site = await updateSite(id, data as Parameters<typeof updateSite>[1]);
      if (!site) return reply.code(404).send({ error: 'Site não encontrado.' });
      return reply.send(site);
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'Domínio já cadastrado.' });
      }
      throw err;
    }
  });

  // DELETE /api/admin/sites/:id — soft delete
  app.delete('/api/admin/sites/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await getSiteById(id);
    if (!site) return reply.code(404).send({ error: 'Site não encontrado.' });
    await softDeleteSite(id);
    return reply.code(204).send();
  });

  // POST /api/admin/sites/:id/restore — restaura site soft-deletado
  app.post('/api/admin/sites/:id/restore', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await getSiteByIdIncludeDeleted(id);
    if (!existing) return reply.code(404).send({ error: 'Site não encontrado.' });
    if (!existing.deleted_at) return reply.code(409).send({ error: 'Site não está excluído.' });
    const site = await restoreSite(id);
    return reply.send(site);
  });

  // POST /api/admin/sites/:id/regenerate-token
  app.post('/api/admin/sites/:id/regenerate-token', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const token = await regenerateSiteToken(id);
    if (!token) return reply.code(404).send({ error: 'Site não encontrado.' });
    return reply.send({ token });
  });

  // GET /api/admin/sites/:id/stats — visão detalhada por site
  app.get('/api/admin/sites/:id/stats', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const stats = await getSiteDetailStats(id);
    if (!stats) return reply.code(404).send({ error: 'Site não encontrado.' });
    return reply.send(stats);
  });
}
