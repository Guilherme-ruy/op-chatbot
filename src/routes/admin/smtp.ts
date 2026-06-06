import type { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { requireAdmin } from '../../middleware/adminAuth';
import { getSmtpSettings, upsertSmtpSettings } from '../../services/adminDatabase';

/** Remove o campo `pass` da resposta e adiciona `pass_configured` (boolean). */
function toPublic(s: Awaited<ReturnType<typeof upsertSmtpSettings>>) {
  const { pass, ...rest } = s;
  return { ...rest, pass_configured: pass.length > 0 };
}

export async function adminSmtpRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAdmin(app) };

  // ── GET /api/admin/smtp ───────────────────────────────────────────────────────
  app.get('/api/admin/smtp', auth, async (_request, reply) => {
    const settings = await getSmtpSettings();
    if (!settings) return reply.send(null);
    return reply.send(toPublic(settings));
  });

  // ── PATCH /api/admin/smtp ─────────────────────────────────────────────────────
  app.patch('/api/admin/smtp', auth, async (request, reply) => {
    const body = request.body as {
      host?:               string;
      port?:               number;
      user_email?:         string;
      pass?:               string;
      from_address?:       string;
      notification_email?: string;
    };

    if (!body.host || !body.user_email || !body.from_address || !body.notification_email) {
      return reply.code(400).send({
        error: 'Campos obrigatórios ausentes: host, user_email, from_address, notification_email.',
      });
    }

    const updated = await upsertSmtpSettings({
      host:               body.host,
      port:               typeof body.port === 'number' ? body.port : 587,
      user_email:         body.user_email,
      pass:               body.pass || undefined, // undefined → preserva senha existente
      from_address:       body.from_address,
      notification_email: body.notification_email,
    });

    return reply.send(toPublic(updated));
  });

  // ── POST /api/admin/smtp/test ─────────────────────────────────────────────────
  app.post('/api/admin/smtp/test', auth, async (_request, reply) => {
    const settings = await getSmtpSettings();

    if (!settings || !settings.user_email || !settings.pass) {
      return reply.code(400).send({
        error: 'SMTP não configurado. Salve as configurações antes de testar.',
      });
    }
    if (!settings.notification_email) {
      return reply.code(400).send({
        error: 'E-mail de notificação não configurado.',
      });
    }

    const transporter = nodemailer.createTransport({
      host:   settings.host,
      port:   settings.port,
      secure: settings.port === 465,
      auth:   { user: settings.user_email, pass: settings.pass },
    });

    await transporter.sendMail({
      from:    settings.from_address || `Chatbot <${settings.user_email}>`,
      to:      settings.notification_email,
      subject: '✅ Teste de configuração SMTP — op-chatbot',
      text:    'Se você recebeu este e-mail, o SMTP está configurado corretamente.',
      html:    `<p style="font-family:sans-serif">
                  Se você recebeu este e-mail, o SMTP está configurado corretamente. ✅
                </p>`,
    });

    return reply.send({ ok: true });
  });
}
