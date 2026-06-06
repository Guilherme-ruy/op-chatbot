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

-- Coluna custom_data nos leads (todos os campos coletados como JSONB)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- Tabela de campos de coleta configuráveis por site
CREATE TABLE IF NOT EXISTS site_fields (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID         NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key        VARCHAR(100) NOT NULL,
  label      VARCHAR(255) NOT NULL,
  hint       TEXT,
  required   BOOLEAN      NOT NULL DEFAULT true,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, key)
);

CREATE INDEX IF NOT EXISTS idx_site_fields_site_id ON site_fields(site_id);

-- Insere campos padrão para sites existentes que ainda não têm configuração
DO $$
DECLARE _site_id UUID;
BEGIN
  FOR _site_id IN SELECT id FROM sites LOOP
    IF NOT EXISTS (SELECT 1 FROM site_fields WHERE site_id = _site_id) THEN
      INSERT INTO site_fields (site_id, key, label, hint, required, sort_order) VALUES
        (_site_id, 'name',        'Nome do visitante',        NULL, true,  0),
        (_site_id, 'service',     'Tipo de serviço',          'Pergunte qual tipo de serviço o visitante precisa. Exemplos: site, sistema, hospedagem, outro. Aceite a resposta como está.', true,  1),
        (_site_id, 'client_type', 'Pessoa física ou empresa',  'Pergunte se é pessoa física ou empresa. Se pessoa física retorne pf, se empresa retorne pj.', false, 2),
        (_site_id, 'cnpj',        'CNPJ',                      'Se o cliente informou ser empresa, pergunte o CNPJ para personalizar a proposta. É opcional — se não quiser informar, siga em frente.', false, 3),
        (_site_id, 'contact',     'WhatsApp ou e-mail',        NULL, true,  4);
    END IF;
  END LOOP;
END $$;

-- Índice para contagem rápida de sessões mensais por site
CREATE INDEX IF NOT EXISTS idx_sessions_site_month
  ON sessions(site_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sites_active
  ON sites(active);

CREATE INDEX IF NOT EXISTS idx_sites_deleted_at
  ON sites(deleted_at) WHERE deleted_at IS NULL;
