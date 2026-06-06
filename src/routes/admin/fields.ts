import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/adminAuth';
import {
  listSiteFields,
  createSiteField,
  updateSiteField,
  deleteSiteField,
  reorderSiteFields,
  resetSiteFields,
  getSiteById,
} from '../../services/adminDatabase';

export async function adminFieldsRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAdmin(app) };

  // GET /api/admin/sites/:id/fields — lista campos do site
  app.get('/api/admin/sites/:id/fields', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await getSiteById(id);
    if (!site) return reply.code(404).send({ error: 'Site não encontrado.' });
    const fields = await listSiteFields(id);
    return reply.send(fields);
  });

  // POST /api/admin/sites/:id/fields — cria novo campo
  app.post('/api/admin/sites/:id/fields', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      key: string;
      label: string;
      hint?: string | null;
      required?: boolean;
      sort_order?: number;
    };

    if (!body.key || !body.label) {
      return reply.code(400).send({ error: 'key e label são obrigatórios.' });
    }

    // Normaliza a chave: lowercase, snake_case
    const key = body.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const site = await getSiteById(id);
    if (!site) return reply.code(404).send({ error: 'Site não encontrado.' });

    try {
      const field = await createSiteField(id, { ...body, key });
      return reply.code(201).send(field);
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'Já existe um campo com essa chave neste site.' });
      }
      throw err;
    }
  });

  // PATCH /api/admin/sites/:id/fields/:fieldId — atualiza campo
  app.patch('/api/admin/sites/:id/fields/:fieldId', auth, async (request, reply) => {
    const { id, fieldId } = request.params as { id: string; fieldId: string };
    const body = request.body as {
      label?: string;
      hint?: string | null;
      required?: boolean;
      sort_order?: number;
    };

    const field = await updateSiteField(fieldId, id, body);
    if (!field) return reply.code(404).send({ error: 'Campo não encontrado.' });
    return reply.send(field);
  });

  // DELETE /api/admin/sites/:id/fields/:fieldId — remove campo
  app.delete('/api/admin/sites/:id/fields/:fieldId', auth, async (request, reply) => {
    const { id, fieldId } = request.params as { id: string; fieldId: string };
    const deleted = await deleteSiteField(fieldId, id);
    if (!deleted) return reply.code(404).send({ error: 'Campo não encontrado.' });
    return reply.code(204).send();
  });

  // PUT /api/admin/sites/:id/fields/reorder — reordena campos
  app.put('/api/admin/sites/:id/fields/reorder', auth, async (request, reply) => {
    const { id }  = request.params as { id: string };
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids deve ser um array não vazio.' });
    }

    await reorderSiteFields(id, ids);
    const fields = await listSiteFields(id);
    return reply.send(fields);
  });

  // POST /api/admin/sites/:id/fields/reset — restaura campos padrão
  app.post('/api/admin/sites/:id/fields/reset', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await getSiteById(id);
    if (!site) return reply.code(404).send({ error: 'Site não encontrado.' });
    const fields = await resetSiteFields(id);
    return reply.send(fields);
  });
}
