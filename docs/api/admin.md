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
{ "email": "contato@exemplo.com.br", "password": "senha" }
```

**Response 200:**
```json
{ "token": "eyJ...", "email": "contato@exemplo.com.br" }
```

**Response 401:** `{ "error": "Credenciais inválidas." }`

---

### GET /auth/me

Retorna dados do usuário autenticado.

**Response 200:**
```json
{ "id": "uuid", "email": "contato@exemplo.com.br" }
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
  "bot_avatar_url": "/uploads/avatars/uuid.png",
  "whatsapp_number": "5511999990000",
  "monthly_session_limit": 500,
  "limit_message": "Olá! Fale conosco pelo WhatsApp.",
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

Lista sites em soft delete (excluídos pelo painel).

---

### POST /sites

Cria um novo site. Token gerado automaticamente com prefixo `chatbot_`. Campos padrão de coleta são inseridos automaticamente via transação.

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
  "site": { "id": "...", "name": "Clínica Silva", "monthly_session_limit": 500, "..." : "..." },
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

## Campos de coleta (site_fields)

Configuram quais informações o chatbot coleta para cada site. Os prompts do LLM são gerados dinamicamente a partir desses campos.

### GET /sites/:id/fields

Lista os campos de coleta do site ordenados por `sort_order`.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "site_id": "uuid",
    "key": "nome_do_visitante",
    "label": "Nome do visitante",
    "hint": null,
    "required": true,
    "sort_order": 0,
    "created_at": "2026-06-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "site_id": "uuid",
    "key": "tipo_de_servico",
    "label": "Tipo de serviço",
    "hint": "Pergunte qual tipo de serviço o visitante precisa. Exemplos: site, sistema, hospedagem, outro.",
    "required": true,
    "sort_order": 1,
    "created_at": "2026-06-01T00:00:00Z"
  }
]
```

---

### POST /sites/:id/fields

Cria um novo campo de coleta.

**Request:**
```json
{
  "key": "segmento_de_mercado",
  "label": "Segmento de mercado",
  "hint": "Pergunte em qual segmento o cliente atua. Exemplos: saúde, educação, varejo.",
  "required": false,
  "sort_order": 5
}
```

> A chave é normalizada automaticamente: lowercase + apenas letras, números e `_`.

**Response 201:** Campo criado.

**Response 409:** Chave já existe para este site.

---

### PATCH /sites/:id/fields/:fieldId

Atualiza `label`, `hint` ou `required` de um campo. A `key` não pode ser alterada após a criação.

**Campos aceitos:** `label`, `hint`, `required`, `sort_order`

**Response 200:** Campo atualizado.

---

### DELETE /sites/:id/fields/:fieldId

Remove um campo. Leads já criados não são afetados (os dados permanecem em `custom_data`).

**Response 204**

---

### PUT /sites/:id/fields/reorder

Reordena os campos enviando o array de IDs na nova ordem desejada.

**Request:**
```json
{ "ids": ["uuid-campo-3", "uuid-campo-1", "uuid-campo-2"] }
```

**Response 200:** Array completo de campos na nova ordem.

---

### POST /sites/:id/fields/reset

Apaga todos os campos do site e restaura os campos padrão:  
`nome_do_visitante` · `tipo_de_servico` · `pessoa_fisica_ou_empresa` · `cnpj` · `whatsapp_ou_e_mail`

**Response 200:** Array com os campos padrão recriados.

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
| `page` | int | Página (padrão: 1) |
| `limit` | int | Itens por página (padrão: 20) |

**Response 200:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "name": "João Silva",
      "contact": "11987654321",
      "project_type": "site",
      "client_type": "pj",
      "cnpj": "12345678000199",
      "budget": null,
      "custom_data": {
        "nome_do_visitante": "João Silva",
        "tipo_de_servico": "site",
        "pessoa_fisica_ou_empresa": "pj",
        "cnpj": "12345678000199",
        "whatsapp_ou_e_mail": "11987654321"
      },
      "site_source": "Clínica Silva",
      "whatsapp_url": "https://wa.me/...",
      "notified_at": "2026-06-01T10:00:00Z",
      "created_at": "2026-06-01T09:55:00Z",
      "site_name": "Clínica Silva",
      "site_domain": "clinicasilva.com.br"
    }
  ],
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
