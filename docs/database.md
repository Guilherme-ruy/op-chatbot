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
| `bot_avatar_url` | TEXT | ✓ | URL do avatar do bot. Uploads locais ficam em `/uploads/avatars/` |
| `whatsapp_number` | VARCHAR(20) | ✓ | Número WhatsApp (ex: `5511999990000`) |
| `plan_name` | VARCHAR(50) | ✓ | Nome do plano (ex: Básico, Pro) |
| `monthly_session_limit` | INT | ✓ | Limite de conversas/mês. `NULL` ou `0` = ilimitado |
| `limit_message` | VARCHAR(500) | ✓ | Texto pré-preenchido no WhatsApp ao atingir o limite |
| `active` | BOOLEAN | — | Se o site está ativo |
| `deleted_at` | TIMESTAMPTZ | ✓ | Soft delete — `NULL` = não deletado |
| `created_at` | TIMESTAMPTZ | — | Data de criação |

**Índices:** `idx_sites_active`, `idx_sites_deleted_at`

---

### `site_fields` — Campos de Coleta por Site

Define quais informações o chatbot deve coletar para cada site, em qual ordem e quais são obrigatórias para qualificar um lead. Ao criar um site, campos padrão são inseridos automaticamente.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | Gerado automaticamente |
| `site_id` | UUID | FK→sites | Site ao qual o campo pertence |
| `key` | VARCHAR(100) | UNIQUE(site) | Identificador snake_case (ex: `nome_do_visitante`) |
| `label` | VARCHAR(255) | — | Nome exibido nos relatórios (ex: `Nome do visitante`) |
| `hint` | TEXT | ✓ | Instrução para o LLM sobre como coletar/interpretar o campo |
| `required` | BOOLEAN | — | Se o campo é obrigatório para qualificação |
| `sort_order` | INT | — | Ordem de coleta na conversa |
| `created_at` | TIMESTAMPTZ | — | Data de criação |

**Constraint:** `UNIQUE(site_id, key)` — chaves únicas por site.

**Índice:** `idx_site_fields_site_id`

**Campos padrão** (inseridos ao criar um novo site):

| sort | key | label | required |
|---|---|---|---|
| 0 | `nome_do_visitante` | Nome do visitante | ✅ |
| 1 | `tipo_de_servico` | Tipo de serviço | ✅ |
| 2 | `pessoa_fisica_ou_empresa` | Pessoa física ou empresa | ❌ |
| 3 | `cnpj` | CNPJ | ❌ |
| 4 | `whatsapp_ou_e_mail` | WhatsApp ou e-mail | ✅ |

---

### `sessions` — Conversas

Uma sessão por conversa iniciada no widget. Acumula dados do lead em JSONB durante a conversa.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | Gerado automaticamente |
| `site_id` | UUID | FK→sites | Site de origem |
| `status` | VARCHAR(20) | — | `active` · `qualified` · `abandoned` |
| `message_count` | INTEGER | — | Total de mensagens (guardrail de custo) |
| `collected_data` | JSONB | — | Dados acumulados do lead (chaves = `site_fields.key`) |
| `created_at` | TIMESTAMPTZ | — | Início da conversa |
| `updated_at` | TIMESTAMPTZ | — | Última atualização |

**Índices:** `idx_sessions_site_id`, `idx_sessions_status`, `idx_sessions_site_month`

**`collected_data` — estrutura (chaves dinâmicas por site):**
```json
{
  "nome_do_visitante":       "João Silva",
  "tipo_de_servico":         "site",
  "pessoa_fisica_ou_empresa": "pj",
  "cnpj":                    "12345678000199",
  "whatsapp_ou_e_mail":      "11987654321"
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

Criado quando todos os campos `required` de um site são preenchidos. Mantém colunas indexadas para consultas rápidas e armazena o snapshot completo em `custom_data`.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID | PK | — |
| `session_id` | UUID | FK→sessions | — |
| `name` | VARCHAR(255) | ✓ | Mapeado de `nome_do_visitante` (ou `name` legado) |
| `project_type` | VARCHAR(100) | ✓ | Mapeado de `tipo_de_servico` (ou `service`/`project_type` legado) |
| `client_type` | VARCHAR(5) | ✓ | `pf` ou `pj` — mapeado de `pessoa_fisica_ou_empresa` |
| `cnpj` | VARCHAR(20) | ✓ | Mapeado de `cnpj` |
| `contact` | VARCHAR(255) | ✓ | Mapeado de `whatsapp_ou_e_mail` (ou `contact` legado) |
| `budget` | VARCHAR(100) | ✓ | Mapeado de `orcamento_estimado` (ou `budget` legado) |
| `custom_data` | JSONB | — | Snapshot completo de todos os campos coletados |
| `site_source` | VARCHAR(255) | ✓ | Nome do site que gerou o lead |
| `whatsapp_url` | TEXT | ✓ | Link WhatsApp pré-preenchido com todos os dados |
| `notified_at` | TIMESTAMPTZ | ✓ | Quando o e-mail de notificação foi enviado |
| `created_at` | TIMESTAMPTZ | — | Data de qualificação |

**Índices:** `idx_leads_session_id`, `idx_leads_created_at`

> As colunas específicas (`name`, `contact`, etc.) são populadas por mapeamento de chaves conhecido + fallback legado. Para sites com campos totalmente customizados, `custom_data` é a fonte de verdade.

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
# Schema principal (chat) — cria sites, sessions, messages, leads, site_fields
npm run db:migrate

# Schema admin — cria admin_users, adiciona colunas em sites, leads, site_fields
npm run db:admin-migrate
```

Ambas as migrations são **idempotentes** — podem ser rodadas múltiplas vezes sem problema.  
A auto-migration roda ambas automaticamente na inicialização do servidor.

---

## Consultas úteis

```sql
-- Leads recentes com todos os dados coletados
SELECT l.name, l.contact, l.custom_data, l.site_source, l.created_at
FROM leads l ORDER BY l.created_at DESC LIMIT 20;

-- Campos configurados por site
SELECT s.name AS site, sf.sort_order, sf.key, sf.label, sf.required
FROM site_fields sf
JOIN sites s ON s.id = sf.site_id
ORDER BY s.name, sf.sort_order;

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
```

---

## Conexão

```bash
# Na VPS (direto no host)
sudo -u postgres psql -d chatbot_db

# Do container Docker
DATABASE_URL=postgresql://postgres:SENHA@host.docker.internal:5432/chatbot_db
```
