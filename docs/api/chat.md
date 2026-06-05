# API — Chat (Widget)

Endpoints consumidos pelo widget no navegador do visitante. Não requerem autenticação — usam o `token` do site para identificação.

**Base URL:** `https://your-domain.com`

---

## POST /api/chat/start

Inicia uma nova sessão de conversa.

**Request:**
```json
{ "token": "chatbot_..." }
```

**Headers obrigatórios:** `Origin` (usado para validação CORS)

**Response 200:**
```json
{
  "sessionId": "uuid-da-sessao",
  "botName": "Assistente",
  "botAvatarUrl": null,
  "welcomeMessage": "Olá! Estou aqui para te ajudar..."
}
```

**Erros:**

| Status | Motivo |
|---|---|
| `401` | Token inválido ou site inativo |
| `403` | Origin não autorizado (domínio não cadastrado) |
| `429` | Limite mensal de conversas atingido |

**Response 429 (limite atingido):**
```json
{
  "error": "Limite mensal de conversas atingido.",
  "limitReached": true,
  "whatsappUrl": "https://wa.me/55..."
}
```

---

## POST /api/chat/message

Envia uma mensagem e recebe a resposta do bot.

**Request:**
```json
{
  "sessionId": "uuid-da-sessao",
  "message": "Meu nome é João e quero um site"
}
```

**Validações do body:**
- `message`: 1–1000 caracteres

**Response 200 — resposta normal:**
```json
{
  "message": "Olá João! Que tipo de site você está pensando?",
  "qualified": false
}
```

**Response 200 — lead qualificado:**
```json
{
  "message": "Perfeito! Nossa equipe entrará em contato em breve.",
  "qualified": true,
  "whatsappUrl": "https://wa.me/5511999990000?text=..."
}
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Sessão encerrada ou mensagem inválida |
| `404` | Sessão não encontrada |

---

## GET /health

Verificação de saúde do servidor.

**Response 200:**
```json
{ "status": "ok", "ts": "2026-06-04T14:32:00.000Z" }
```

---

## Fluxo completo de uma sessão

```
1. Widget carrega → lê data-token do <script>
2. POST /api/chat/start → recebe sessionId + welcomeMessage
3. Exibe welcome message no painel
4. Usuário digita → POST /api/chat/message
5. Repete passo 4 até qualified = true
6. qualified = true → exibe botão WhatsApp com whatsappUrl
```

---

## Rate limiting global

Além do rate limit por site (ver [rate-limiting.md](../rate-limiting.md)), existe um limite global de **60 requisições por minuto** por IP aplicado a todas as rotas.
