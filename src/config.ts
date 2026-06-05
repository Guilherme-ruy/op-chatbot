import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // LLM — atualmente Google Gemini, configurável via env vars
  llmApiKey: required('LLM_API_KEY'),
  llmModel:  process.env.LLM_MODEL || 'gemini-3.1-flash-lite',

  databaseUrl: required('DATABASE_URL'),

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    from: process.env.SMTP_FROM || 'Chatbot <noreply@example.com>',
  },

  notificationEmail: required('NOTIFICATION_EMAIL'),

  // Allowed origins for the widget
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'localhost')
    .split(',')
    .map(d => d.trim()),

  maxMessagesPerSession: parseInt(process.env.MAX_MESSAGES_PER_SESSION || '20'),

  // Admin panel
  adminJwtSecret: (() => {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('ADMIN_JWT_SECRET ausente ou menor que 32 caracteres');
    }
    return secret;
  })(),
} as const;
