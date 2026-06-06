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

## Sites

### GET /sites

Lista todos os sites ativos (não deletados) com estatísticas agregadas.

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
  "monthly_session_limit": 500,
  "limit_message": "Olá! Atingimos nosso limite mensal. Fale conosco pelo WhatsApp!",
  "active": true,
  "deleted_at": null,
  "created_at": "2026-06-01T00:00:00Z",
  "total_sessions": 42,
  "qualified_sessions": 18,
  "total_leads": 18
}
```

---

---

## Upload

### POST /upload/avatar

Faz upload de uma imagem de avatar. Retorna a URL pública do arquivo salvo.

**Content-Type:** `multipart/form-data`  
**Campo:** `file` (imagem)  
**Restrições:** JPG, PNG, WebP ou GIF · máx. 2 MB

**Response 200:**
```json
{ "url": "/uploads/avatars/uuid.png" }
```

**Response 400:** formato inválido  
**Response 413:** arquivo maior que 2 MB

> A URL retornada deve ser salva em `bot_avatar_url` via `PATCH /sites/:id`.

---

### DELETE /upload/avatar

Remove um avatar do disco.

**Request:**
```json
{ "path": "/uploads/avatars/uuid.png" }
```

**Response 204** (sem corpo)  
Falha silenciosa se o arquivo não existir. Rejeita caminhos fora de `/uploads/avatars/`.

---

### GET /sites/deleted

Lista sites em soft delete (excluídos pelo painel).

---

### POST /sites

Cria um novo site. Token gerado automaticamente com prefixo `chatbot_`.

**Request:**
```json
{
  "name": "Clínica Silva",
  "domain": "clinicasilva.com.br",
  "bot_name": "Ana da Clínica Silva",
  "bot_avatar_url": null,
  "whatsapp_number": "5511999990000",
  "monthly_session_limit": 100,
  "limit_message": "Olá! Atingimos nosso limite. Fale conosco pelo WhatsApp!"
}
```

**Response 201:** Site criado com token.

**Response 409:** Domínio já cadastrado.

---

### PATCH /sites/:id

Atualiza campos do site. Apenas os campos enviados são alterados.

**Campos aceitos:** `name`, `domain`, `bot_name`, `bot_avatar_url`, `whatsapp_number`, `monthly_session_limit`, `limit_message`, `active`

---

### DELETE /sites/:id

Soft delete — define `deleted_at = NOW()` e `active = false`. Os dados são preservados.

**Response 204**

---

### POST /sites/:id/restore

Restaura um site soft-deletado (`deleted_at = NULL`, `active = true`).

---

### POST /sites/:id/regenerate-token

Gera um novo token para o site. **O token anterior para de funcionar imediatamente.**

**Response 200:** `{ "token": "chatbot_novotoken..." }`

---

### GET /sites/all/stats?days=30

Retorna estatísticas **agregadas de todos os sites**.

**Query params:**

| Param | Valores aceitos | Padrão | Descrição |
|---|---|---|---|
| `days` | `7`, `30`, `90`, `0` | `30` | Período. `0` = todo o histórico |

**Response 200:** Mesmo formato de `/sites/:id/stats` mas com `site: null`.

---

### GET /sites/:id/stats?days=30

Retorna estatísticas detalhadas de um site específico.

**Query params:**

| Param | Valores aceitos | Padrão | Descrição |
|---|---|---|---|
| `days` | `7`, `30`, `90`, `0` | `30` | Período. `0` = todo o histórico |

**Campos afetados pelo período:** `leads_in_period`, `avg_messages_per_session`, `abandonment_rate`, `sessions_by_day`, `leads_by_project`, `peak_hours`.

**Campos fixos (independem do período):**
- `sessions_this_month`, `qualified_this_month` — sempre mês corrente (para card "Uso mensal")
- `total_sessions_all`, `total_leads_all` — sempre histórico completo
- `recent_leads` — sempre os 5 leads mais recentes

**Response 200:**
```json
{
  "site": { "id": "...", "name": "Clínica Silva", "domain": "...", "monthly_session_limit": 500, ... },
  "sessions_this_month": 42,
  "qualified_this_month": 18,
  "leads_in_period": 15,
  "total_sessions_all": 150,
  "total_leads_all": 63,
  "avg_messages_per_session": 7.2,
  "abandonment_rate": 28.5,
  "sessions_by_day": [{ "date": "2026-06-01", "sessions": 3, "leads": 1 }],
  "leads_by_project": [{ "type": "site", "count": 10 }],
  "peak_hours": [{ "hour": 14, "count": 8 }],
  "recent_leads": [{ "id": "...", "name": "João", "contact": "...", "project_type": "site", "whatsapp_url": "...", "created_at": "..." }]
}
```

> Para `days=0` (todo o período), `sessions_by_day` agrupa por **mês** (`"date": "2026-06"`) em vez de por dia.

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
