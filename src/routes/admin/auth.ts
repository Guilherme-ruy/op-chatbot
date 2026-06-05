import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getAdminUserByEmail, updateAdminLastLogin } from '../../services/adminDatabase';
import { requireAdmin } from '../../middleware/adminAuth';

export async function adminAuthRoutes(app: FastifyInstance) {
  // POST /api/admin/auth/login
  app.post('/api/admin/auth/login', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' },
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = await getAdminUserByEmail(email);
    if (!user) {
      return reply.code(401).send({ error: 'Credenciais inválidas.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Credenciais inválidas.' });
    }

    await updateAdminLastLogin(user.id);

    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: '8h' }
    );

    return reply.send({ token, email: user.email });
  });

  // GET /api/admin/auth/me
  app.get('/api/admin/auth/me', {
    preHandler: requireAdmin(app),
  }, async (request, reply) => {
    return reply.send(request.adminUser);
  });
}
