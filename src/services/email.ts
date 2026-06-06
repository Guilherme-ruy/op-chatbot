import nodemailer from 'nodemailer';
import { config } from '../config';
import type { SiteField } from '../types';
import { getSmtpSettings } from './adminDatabase';

// ── Transporter factory ───────────────────────────────────────────────────────
// Lido do banco a cada envio para refletir alterações feitas no painel admin
// sem precisar reiniciar o servidor.
// Fallback: variáveis de ambiente (SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL).

async function buildTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  from: string;
  notificationEmail: string;
}> {
  const db = await getSmtpSettings();

  if (db?.user_email && db?.pass) {
    return {
      transporter: nodemailer.createTransport({
        host:   db.host,
        port:   db.port,
        secure: db.port === 465,
        auth:   { user: db.user_email, pass: db.pass },
      }),
      from:              db.from_address || `Chatbot <${db.user_email}>`,
      notificationEmail: db.notification_email,
    };
  }

  // Fallback: variáveis de ambiente
  if (!config.smtp.user || !config.smtp.pass || !config.notificationEmail) {
    throw new Error(
      'SMTP não configurado. Acesse Painel → E-mail para configurar, ou defina SMTP_USER, SMTP_PASS e NOTIFICATION_EMAIL no .env.'
    );
  }

  return {
    transporter: nodemailer.createTransport({
      host:   config.smtp.host,
      port:   config.smtp.port,
      secure: config.smtp.port === 465,
      auth:   { user: config.smtp.user, pass: config.smtp.pass },
    }),
    from:              config.smtp.from || `Chatbot <${config.smtp.user}>`,
    notificationEmail: config.notificationEmail,
  };
}

// ── Template HTML do e-mail ───────────────────────────────────────────────────

function buildEmailHtml(
  customData: Record<string, string | null>,
  fields: SiteField[],
  siteName: string,
  whatsappUrl: string
): string {
  const row = (label: string, value: string | null) =>
    value
      ? `<tr>
           <td style="padding:8px 12px;font-weight:600;color:#666;width:140px;white-space:nowrap">${label}</td>
           <td style="padding:8px 12px;color:#1a1a1a">${value}</td>
         </tr>`
      : '';

  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const rows = sorted
    .map(f => row(f.label, customData[f.key] ?? null))
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#0d0d0d;padding:28px 32px;display:flex;align-items:center;gap:12px">
      <div style="width:40px;height:40px;background:#25D366;border-radius:10px;display:flex;align-items:center;justify-content:center">
        <span style="color:#fff;font-size:20px">💬</span>
      </div>
      <div>
        <p style="margin:0;color:#fff;font-size:18px;font-weight:700">Novo Lead Qualificado</p>
        <p style="margin:4px 0 0;color:#aaa;font-size:13px">via ${siteName}</p>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px;color:#444;font-size:14px">
        Um visitante completou a conversa com o assistente e está pronto para ser atendido.
      </p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:10px;overflow:hidden">
        ${rows}
      </table>

      <!-- CTA WhatsApp -->
      <div style="margin-top:28px;text-align:center">
        <a href="${whatsappUrl}"
           style="display:inline-block;padding:14px 32px;background:#25D366;color:#fff;font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;box-shadow:0 4px 14px rgba(37,211,102,.35)">
          Abrir conversa no WhatsApp →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee">
      <p style="margin:0;font-size:12px;color:#999;text-align:center">
        Chatbot · ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

// ── Função exportada ──────────────────────────────────────────────────────────

export async function sendLeadNotification(
  customData: Record<string, string | null>,
  fields: SiteField[],
  siteName: string,
  whatsappUrl: string
): Promise<void> {
  const { transporter, from, notificationEmail } = await buildTransporter();

  const name = customData['nome_do_visitante'] ?? customData['name'] ?? 'Visitante';
  const subject = `🎯 Novo lead: ${name} (${siteName})`;

  // Texto simples para clientes de e-mail sem HTML
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const textLines = sorted
    .filter(f => customData[f.key])
    .map(f => `${f.label}: ${customData[f.key]}`);
  const textBody = [
    `Novo lead qualificado via ${siteName}.`,
    '',
    ...textLines,
    '',
    `WhatsApp: ${whatsappUrl}`,
  ].join('\n');

  await transporter.sendMail({
    from,
    to:      notificationEmail,
    subject,
    html:    buildEmailHtml(customData, fields, siteName, whatsappUrl),
    text:    textBody,
  });
}
