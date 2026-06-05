# API — Admin

Endpoints do painel administrativo. **Todos requerem autenticação JWT** via header `Authorization: Bearer <token>`.

**Base URL:** `https://your-domain.com/api/admin`

---

## Autenticação

### POST /auth/login

Autentica o administrador e retorna um JWT válido por 8 horas.

**Rate limit:** 5 tentativas por 15 minutos.

**Request:**
```json
{ "email": "contato@guilhermeruy.com.br", "password": "senha" }
```

**Response 200:**
```json
{ "token": "eyJ...", "email": "contato@guilhermeruy.com.br" }
```

**Response 401:** `{ "error": "Credenciais inválidas." }`

---

### GET /auth/me

Retorna dados do usuário autenticado.

**Response 200:**
```json
{ "id": "uuid", "email": "contato@guilhermeruy.com.br" }
```

---

## Sites (Clientes)

### GET /sites

Lista todos os clientes ativos (não deletados) com estatísticas agregadas.

**Response 200:** Array de sites com:
```json
{
  "id": "uuid",
  "name": "Clínica Silva",
  "domain": "clinicasilva.com.br",
  "token": "chatbot_...",
  "bot_name": "Ana",
  "bot_avatar_url": null,
  "whatsapp_number": "5511999990000",
  "plan_name": "Pro",
  "monthly_session_limit": 500,
  "active": true,
  "deleted_at": null,
  "created_at": "2026-06-01T00:00:00Z",
  "total_sessions": 42,
  "qualified_sessions": 18,
  "total_leads": 18
}
```

---

### GET /sites/deleted

Lista clientes em soft delete (excluídos pelo painel).

---

### POST /sites

Cria um novo cliente. Token gerado automaticamente com prefixo `chatbot_`.

**Request:**
```json
{
  "name": "Clínica Silva",
  "domain": "clinicasilva.com.br",
  "bot_name": "Ana da Clínica Silva",
  "bot_avatar_url": null,
  "whatsapp_number": "5511999990000",
  "plan_name": "Básico",
  "monthly_session_limit": 100
}
```

**Response 201:** Site criado com token.

**Response 409:** Domínio já cadastrado.

---

### PATCH /sites/:id

Atualiza campos do cliente. Apenas os campos enviados são alterados.

**Campos aceitos:** `name`, `domain`, `bot_name`, `bot_avatar_url`, `whatsapp_number`, `plan_name`, `monthly_session_limit`, `active`

---

### DELETE /sites/:id

Soft delete — define `deleted_at = NOW()` e `active = false`. Os dados são preservados.

**Response 204**

---

### POST /sites/:id/restore

Restaura um cliente soft-deletado (`deleted_at = NULL`, `active = true`).

---

### POST /sites/:id/regenerate-token

Gera um novo token para o site. **O token anterior para de funcionar imediatamente.**

**Response 200:** `{ "token": "chatbot_novotoken..." }`

---

### GET /sites/:id/stats

Retorna estatísticas detalhadas de um site. Ver [admin-panel.md](../admin-panel.md#visão-por-site) para a descrição de cada campo.

**Response 200:**
```json
{
  "site": { ... },
  "sessions_this_month": 42,
  "qualified_this_month": 18,
  "leads_this_month": 18,
  "total_sessions_all": 150,
  "total_leads_all": 63,
  "avg_messages_per_session": 7.2,
  "abandonment_rate": 28.5,
  "qualification_rate": 42,
  "sessions_by_day": [{ "date": "2026-06-01", "sessions": 3, "leads": 1 }],
  "leads_by_project": [{ "type": "site", "count": 10 }],
  "peak_hours": [{ "hour": 14, "count": 8 }],
  "recent_leads": [{ "id": "...", "name": "João", "contact": "...", ... }]
}
```

---

## Leads

### GET /leads

Lista leads com filtros e paginação.

**Query params:**

| Param | Tipo | Descrição |
|---|---|---|
| `siteId` | UUID | Filtra por site |
| `dateFrom` | date (YYYY-MM-DD) | Data inicial |
| `dateTo` | date (YYYY-MM-DD) | Data final |
| `search` | string | Busca em nome e contato (ILIKE) |
| `projectType` | string | `site`, `sistema`, `hospedagem`, `outro` |
| `page` | int | Página (padrão: 1) |
| `limit` | int | Itens por página (padrão: 20) |

**Response 200:**
```json
{
  "leads": [...],
  "total": 87,
  "page": 1,
  "limit": 20
}
```

---

### GET /leads/export

Exporta leads em CSV com os mesmos filtros do GET /leads (sem paginação).

**Response:** `text/csv` com BOM UTF-8 (compatível com Excel).

**Headers:** `Content-Disposition: attachment; filename="leads-YYYY-MM-DD.csv"`

---

## Sessões

### GET /sessions

Lista sessões com filtros e paginação.

**Query params:** `siteId`, `status`, `dateFrom`, `dateTo`, `page`, `limit`

---

### GET /sessions/:id/messages

Retorna o histórico completo de mensagens de uma sessão.

**Response 200:**
```json
[
  { "id": "...", "role": "bot", "content": "Olá! ...", "created_at": "..." },
  { "id": "...", "role": "user", "content": "Oi, meu nome é João", "created_at": "..." }
]
```

---

## Dashboard

### GET /dashboard

Retorna KPIs e séries temporais dos últimos 30 dias (todos os sites).

**Response 200:**
```json
{
  "total_sites_active": 5,
  "total_sessions_30d": 320,
  "total_qualified_30d": 134,
  "total_leads_30d": 134,
  "qualification_rate": 41,
  "leads_by_day": [{ "date": "2026-06-01", "count": 4 }],
  "leads_by_project": [{ "type": "site", "count": 80 }],
  "top_sites": [{ "name": "Clínica Silva", "domain": "...", "leads": 18, "sessions": 42 }]
}
```
