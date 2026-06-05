# Banco de Dados

**Banco:** `chatbot_db` (configurável via `DATABASE_URL`) | **PostgreSQL 17** | **Encoding:** UTF8

---

## Tabelas

### `sites` — Clientes

Cada site/cliente cadastrado no painel. O `token` é enviado pelo widget para identificar o site.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | Gerado automaticamente |
| `name` | VARCHAR(100) | — | Nome do cliente |
| `domain` | VARCHAR(255) | UNIQUE | Domínio do site (sem http) |
| `token` | VARCHAR(100) | UNIQUE | Token secreto do widget |
| `bot_name` | VARCHAR(100) | — | Nome do assistente no chat |
| `bot_avatar_url` | TEXT | ✓ | URL do avatar do bot |
| `whatsapp_number` | VARCHAR(20) | ✓ | Número WhatsApp (ex: `5511999990000`) |
| `plan_name` | VARCHAR(50) | ✓ | Nome do plano (ex: Básico, Pro) |
| `monthly_session_limit` | INT | ✓ | Limite de conversas/mês. `NULL` ou `0` = ilimitado |
| `limit_message` | VARCHAR(500) | ✓ | Mensagem exibida na bolha do widget ao atingir o limite |
| `active` | BOOLEAN | — | Se o site está ativo |
| `deleted_at` | TIMESTAMPTZ | ✓ | Soft delete — `NULL` = não deletado |
| `created_at` | TIMESTAMPTZ | — | Data de criação |

**Índices:** `idx_sites_active`, `idx_sites_deleted_at`

---

### `sessions` — Conversas

Uma sessão por conversa iniciada no widget. Acumula dados do lead em JSONB durante a conversa.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | Gerado automaticamente |
| `site_id` | UUID | FK→sites | Site de origem |
| `status` | VARCHAR(20) | — | `active` · `qualified` · `abandoned` |
| `message_count` | INTEGER | — | Total de mensagens (guardrail de custo) |
| `collected_data` | JSONB | — | Dados acumulados do lead |
| `created_at` | TIMESTAMPTZ | — | Início da conversa |
| `updated_at` | TIMESTAMPTZ | — | Última atualização |

**Índices:** `idx_sessions_site_id`, `idx_sessions_status`, `idx_sessions_site_month`

**`collected_data` — estrutura:**
```json
{
  "name":        "João Silva",
  "projectType": "site",
  "clientType":  "pj",
  "cnpj":        "12345678000199",
  "contact":     "11987654321",
  "budget":      "R$ 5.000"
}
```

---

### `messages` — Histórico

Todas as mensagens de todas as conversas. Usadas para montar o contexto enviado ao LLM a cada turno.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | — |
| `session_id` | UUID | FK→sessions | — |
| `role` | VARCHAR(5) | — | `user` ou `bot` |
| `content` | TEXT | — | Conteúdo da mensagem |
| `created_at` | TIMESTAMPTZ | — | — |

**Índice:** `idx_messages_session_id`

---

### `leads` — Leads Qualificados

Criado apenas quando o visitante fornece nome + tipo de projeto + contato válido.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | — |
| `session_id` | UUID | FK→sessions | — |
| `name` | VARCHAR(255) | ✓ | Nome do lead |
| `project_type` | VARCHAR(100) | ✓ | `site` · `sistema` · `hospedagem` · `outro` |
| `client_type` | VARCHAR(5) | ✓ | `pf` (pessoa física) ou `pj` (empresa) |
| `cnpj` | VARCHAR(20) | ✓ | Só para PJ |
| `contact` | VARCHAR(255) | ✓ | WhatsApp (11 dígitos) ou e-mail |
| `budget` | VARCHAR(100) | ✓ | Orçamento mencionado (opcional) |
| `site_source` | VARCHAR(255) | ✓ | Nome do site que gerou o lead |
| `whatsapp_url` | TEXT | ✓ | Link WhatsApp pré-preenchido |
| `notified_at` | TIMESTAMPTZ | ✓ | Quando o e-mail de notificação foi enviado |
| `created_at` | TIMESTAMPTZ | — | Data de qualificação |

**Índices:** `idx_leads_session_id`, `idx_leads_created_at`

---

### `admin_users` — Usuários do Painel

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | — |
| `email` | VARCHAR(255) | UNIQUE | E-mail de login |
| `password_hash` | VARCHAR(255) | — | bcrypt (cost 12) |
| `created_at` | TIMESTAMPTZ | — | — |
| `last_login_at` | TIMESTAMPTZ | ✓ | Último acesso |

---

## Migrations

```bash
# Schema principal (chat) — cria sites, sessions, messages, leads
npm run db:migrate

# Schema admin — cria admin_users, adiciona colunas novas em sites
npm run db:admin-migrate
```

Ambas as migrations são **idempotentes** (usam `IF NOT EXISTS` / `IF NOT EXISTS`) — podem ser rodadas múltiplas vezes sem problema.

---

## Consultas úteis

```sql
-- Leads recentes com site de origem
SELECT l.name, l.project_type, l.contact, l.site_source, l.created_at
FROM leads l ORDER BY l.created_at DESC LIMIT 20;

-- Uso mensal por site
SELECT s.name, s.monthly_session_limit,
  COUNT(ss.id) FILTER (
    WHERE DATE_TRUNC('month', ss.created_at) = DATE_TRUNC('month', NOW())
  ) AS sessions_this_month
FROM sites s
LEFT JOIN sessions ss ON ss.site_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id ORDER BY sessions_this_month DESC;

-- Sessões por status
SELECT status, COUNT(*) FROM sessions GROUP BY status;

-- Leads sem notificação de e-mail (falha no SMTP)
SELECT name, contact, created_at FROM leads WHERE notified_at IS NULL;

-- Taxa de qualificação por site (últimos 30 dias)
SELECT s.name,
  COUNT(ss.id) AS total,
  COUNT(ss.id) FILTER (WHERE ss.status = 'qualified') AS qualified,
  ROUND(100.0 * COUNT(ss.id) FILTER (WHERE ss.status = 'qualified') / NULLIF(COUNT(ss.id), 0), 1) AS rate_pct
FROM sites s
JOIN sessions ss ON ss.site_id = s.id
WHERE ss.created_at >= NOW() - INTERVAL '30 days'
GROUP BY s.id;
```

---

## Conexão

```bash
# Na VPS (direto no host)
sudo -u postgres psql -d chatbot_db

# Do container Docker
DATABASE_URL=postgresql://postgres:SENHA@host.docker.internal:5432/chatbot_db
```
