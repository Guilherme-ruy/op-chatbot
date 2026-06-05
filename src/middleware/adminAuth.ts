import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Factory que retorna um preHandler para proteger rotas admin.
 * Valida o Bearer token JWT e injeta request.adminUser.
 */
export function requireAdmin(app: FastifyInstance) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Token não fornecido.' });
    }
    const token = authHeader.slice(7);
    try {
      const payload = app.jwt.verify<{ id: string; email: string }>(token);
      request.adminUser = { id: payload.id, email: payload.email };
    } catch {
      return reply.code(401).send({ error: 'Token inválido ou expirado.' });
    }
  };
}
