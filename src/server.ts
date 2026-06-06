import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { join } from 'path';
import { config } from './config';
import { pool } from './db/pool';
import { runMigrations } from './db/autoMigrate';
import { chatRoutes } from './routes/chat';
import { adminAuthRoutes } from './routes/admin/auth';
import { adminSitesRoutes } from './routes/admin/sites';
import { adminLeadsRoutes }    from './routes/admin/leads';
import { adminSessionsRoutes }  from './routes/admin/sessions';
import { adminDashboardRoutes } from './routes/admin/dashboard';
import { adminUploadRoutes }    from './routes/admin/upload';
import { adminFieldsRoutes }    from './routes/admin/fields';
import { cleanupStaleSessions } from './services/database';

async function build() {
  const app = Fastify({
    logger: { level: config.isDev ? 'info' : 'warn' },
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: (origin, cb) => {
      // Permite ausência de origin (ex: Postman, server-to-server)
      if (!origin) return cb(null, true);

      const host = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const allowed =
        config.isDev ||
        host === 'localhost' ||
        host.startsWith('localhost:') ||
        config.allowedOrigins.some(
          a => host === a || host.endsWith(`.${a}`)
        );

      cb(allowed ? null : new Error('Origem bloqueada por CORS'), allowed);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // ── Rate Limit ──────────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Muitas requisições. Aguarde um momento.',
    }),
  });

  // ── JWT (admin) ─────────────────────────────────────────────────────────────
  await app.register(jwt, {
    secret: config.adminJwtSecret,
    sign: { expiresIn: '8h' },   // default global — cada rota pode sobrescrever
  });

  // ── Multipart (upload de avatares) ──────────────────────────────────────────
  await app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  });

  // ── Arquivos estáticos (widget.js) ──────────────────────────────────────────
  await app.register(staticFiles, {
    root:          join(__dirname, '..', 'public'),
    prefix:        '/',
    decorateReply: false,
    setHeaders: (res) => {
      // Cache de 5 minutos em produção — widget.js muda com deploy
      res.setHeader('Cache-Control', config.isDev
        ? 'no-store'
        : 'public, max-age=300'
      );
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });

  // ── Arquivos estáticos (avatares enviados via upload) ───────────────────────
  await app.register(staticFiles, {
    root:          join(process.cwd(), 'uploads'),
    prefix:        '/uploads/',
    decorateReply: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h de cache
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });

  // ── Rotas de chat ────────────────────────────────────────────────────────────
  await app.register(chatRoutes);

  // ── Rotas admin ──────────────────────────────────────────────────────────────
  await app.register(adminAuthRoutes);
  await app.register(adminSitesRoutes);
  await app.register(adminLeadsRoutes);
  await app.register(adminSessionsRoutes);
  await app.register(adminDashboardRoutes);
  await app.register(adminUploadRoutes);
  await app.register(adminFieldsRoutes);

  // ── Admin SPA (Vue 3 + Vuetify) — catch-all para Vue Router history mode ────
  // Deve vir DEPOIS dos plugins estáticos para que arquivos reais tenham prioridade
  app.get('/admin', async (_req, reply) => {
    return reply.sendFile('index.html', join(__dirname, '..', 'public', 'admin'));
  });
  app.get('/admin/*', async (_req, reply) => {
    return reply.sendFile('index.html', join(__dirname, '..', 'public', 'admin'));
  });

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // ── Error handler global ─────────────────────────────────────────────────────
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const statusCode = err.statusCode ?? 500;
    reply.code(statusCode).send({ error: err.message || 'Erro interno do servidor.' });
  });

  return app;
}

// ── Start ─────────────────────────────────────────────────────────────────────
runMigrations()
  .then(build)
  .then(async app => {
    try {
      await app.listen({ port: config.port, host: '0.0.0.0' });
      console.log(`🚀 Chatbot rodando na porta ${config.port}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }

    // ── Limpeza de sessões inativas ──────────────────────────────────────────────
    // Sessões 'active' sem atividade há mais de 30min são marcadas como 'abandoned'.
    // Executado na inicialização (cobre histórico) e a cada hora.
    const runSessionCleanup = async () => {
      try {
        const count = await cleanupStaleSessions(30);
        if (count > 0) app.log.info(`Sessões inativas encerradas: ${count}`);
      } catch (err) {
        app.log.error({ err }, 'Erro na limpeza de sessões inativas');
      }
    };
    await runSessionCleanup();
    const cleanupInterval = setInterval(runSessionCleanup, 60 * 60 * 1000); // 1h

    // Graceful shutdown — fecha conexões do pool ao encerrar o processo
    const shutdown = async (signal: string) => {
      app.log.info(`Sinal ${signal} recebido — encerrando servidor...`);
      clearInterval(cleanupInterval);
      await app.close();
      await pool.end();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })
  .catch(err => {
    console.error('❌ Falha crítica na inicialização:', err);
    process.exit(1);
  });
