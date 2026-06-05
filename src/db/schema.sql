-- op-chatbot — Schema do banco de dados
-- Execute: psql $DATABASE_URL -f src/db/schema.sql

-- Habilita extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Sites registrados (1 token por domínio) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  domain       VARCHAR(255) NOT NULL UNIQUE,
  token        VARCHAR(100) NOT NULL UNIQUE,
  bot_name     VARCHAR(100) NOT NULL DEFAULT 'Assistente',
  bot_avatar_url TEXT,
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sessões de conversa ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | qualified | abandoned
  message_count  INTEGER     NOT NULL DEFAULT 0,
  collected_data JSONB       NOT NULL DEFAULT '{}',       -- acumulador de dados do lead
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_site_id  ON sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status   ON sessions(status);

-- ── Mensagens da conversa ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role         VARCHAR(5)  NOT NULL CHECK (role IN ('user', 'bot')),
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- ── Leads qualificados ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name           VARCHAR(255),
  project_type   VARCHAR(100),
  client_type    VARCHAR(5)  CHECK (client_type IN ('pf', 'pj')),
  cnpj           VARCHAR(20),
  contact        VARCHAR(255),
  budget         VARCHAR(100),
  site_source    VARCHAR(255),
  whatsapp_url   TEXT,
  notified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_session_id ON leads(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ── Seed: site de exemplo (opcional) ─────────────────────────────────────────
-- Remova ou adapte antes de rodar em produção.
-- Os tokens reais são gerados pelo script db:migrate.
INSERT INTO sites (name, domain, token, bot_name) VALUES
  ('Meu Site',  'example.com',  'REPLACE_TOKEN_EXAMPLE', 'Assistente')
ON CONFLICT (domain) DO NOTHING;
