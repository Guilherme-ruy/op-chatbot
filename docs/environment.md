# Variáveis de Ambiente

Todas as variáveis ficam no arquivo `.env` na raiz do projeto (nunca versionado). Use `.env.example` como referência.

---

## Backend

### Servidor

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta em que o Fastify escuta |
| `NODE_ENV` | `development` | `development` ou `production`. Afeta: nível de log (info vs warn), validação de CORS (permissivo vs banco) e cache do widget.js (sem cache vs 5 min) |

### LLM

| Variável | Obrigatório | Descrição |
|---|---|---|
| `LLM_API_KEY` | ✅ | Chave de API do provedor LLM atual (Google Gemini) |
| `LLM_MODEL` | — | Modelo a usar. Padrão: `gemini-3.1-flash-lite` |

> Para trocar de provedor, veja [llm.md](./llm.md).

### Banco de Dados

| Variável | Obrigatório | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection string PostgreSQL. Ex: `postgresql://chatbot_user:password@localhost:5432/chatbot_db` |

### E-mail (SMTP)

| Variável | Padrão | Descrição |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | `587` | Porta SMTP |
| `SMTP_USER` | — | Usuário SMTP |
| `SMTP_PASS` | — | Senha SMTP |
| `SMTP_FROM` | — | Remetente dos e-mails (ex: `Chatbot <noreply@exemplo.com>`) |
| `NOTIFICATION_EMAIL` | — | E-mail que recebe as notificações de novos leads |

> **Estas variáveis são opcionais.** A configuração SMTP pode ser feita diretamente no painel admin (página **E-mail**), onde fica armazenada no banco de dados e tem precedência sobre as variáveis de ambiente. Use o `.env` como fallback ou para ambientes sem painel ativo.

### Limites

| Variável | Padrão | Descrição |
|---|---|---|
| `MAX_MESSAGES_PER_SESSION` | `20` | Máximo de mensagens por conversa (guardrail de custo LLM) |

> Os domínios autorizados a usar o widget são lidos diretamente do banco — qualquer site cadastrado no painel funciona automaticamente, sem variável de ambiente.

---

## Admin Panel

| Variável | Obrigatório | Descrição |
|---|---|---|
| `ADMIN_JWT_SECRET` | ✅ | Segredo para assinar os tokens JWT do painel. Mínimo 32 caracteres |
| `ADMIN_EMAIL` | ✅ (só no `db:admin-migrate`) | E-mail do usuário administrador |
| `ADMIN_PASSWORD` | ✅ (só no `db:admin-migrate`) | Senha em texto puro — usada apenas para gerar o hash bcrypt. Pode ser removida depois |

> `ADMIN_JWT_SECRET` deve ser uma string aleatória longa. Gere com:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Exemplo completo (`.env.example`)

```env
# Servidor
PORT=3001
NODE_ENV=production

# LLM
LLM_API_KEY=your_llm_api_key_here
LLM_MODEL=gemini-3.1-flash-lite

# Banco
DATABASE_URL=postgresql://chatbot_user:password@localhost:5432/chatbot_db

# SMTP (opcional — pode ser configurado pelo painel admin em vez do .env)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=contato@exemplo.com.br
# SMTP_PASS=your_smtp_password
# SMTP_FROM="Chatbot <contato@exemplo.com.br>"
# NOTIFICATION_EMAIL=contato@exemplo.com.br

# CORS
ALLOWED_ORIGINS=example.com,www.example.com
MAX_MESSAGES_PER_SESSION=20

# Admin
ADMIN_JWT_SECRET=your_random_secret_at_least_32_chars
ADMIN_EMAIL=contato@guilhermeruy.com.br
# ADMIN_PASSWORD=your_initial_password  ← remove after db:admin-migrate
```

---

## Notas de segurança

- Nunca comite o `.env` (está no `.gitignore`)
- `ADMIN_PASSWORD` existe apenas para o seed inicial — remova do `.env` após rodar `db:admin-migrate`
- `LLM_API_KEY` e `ADMIN_JWT_SECRET` devem ser diferentes entre ambientes
- No Docker, as variáveis são injetadas via `env_file: .env` no `docker-compose.yml`
