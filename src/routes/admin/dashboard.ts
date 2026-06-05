import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/adminAuth';
import { getDashboardStats } from '../../services/adminDatabase';

export async function adminDashboardRoutes(app: FastifyInstance) {
  app.get('/api/admin/dashboard', { preHandler: requireAdmin(app) }, async (_req, reply) => {
    const stats = await getDashboardStats();
    return reply.send(stats);
  });
}
