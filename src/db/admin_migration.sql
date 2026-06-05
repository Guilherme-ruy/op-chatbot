-- ────────────────────────────────────────────────────────────────────────────
-- Admin migration — executar UMA VEZ: npm run db:admin-migrate
-- ────────────────────────────────────────────────────────────────────────────

-- Tabela de usuários admin
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Soft delete em sites: deleted_at = NULL significa não deletado
ALTER TABLE sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Número do WhatsApp por site (usado para gerar a URL de contato ao qualificar lead)
-- Formato: código país + DDD + número, ex: 5519993472521
ALTER TABLE sites ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);

-- Plano e limite mensal de conversas (NULL = ilimitado)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS monthly_session_limit INT;

-- Mensagem personalizada exibida no widget quando o limite mensal é atingido
ALTER TABLE sites ADD COLUMN IF NOT EXISTS limit_message VARCHAR(500);

-- Índice para contagem rápida de sessões mensais por site
CREATE INDEX IF NOT EXISTS idx_sessions_site_month
  ON sessions(site_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sites_active
  ON sites(active);

CREATE INDEX IF NOT EXISTS idx_sites_deleted_at
  ON sites(deleted_at) WHERE deleted_at IS NULL;
