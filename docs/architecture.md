# Arquitetura

## Fluxo principal — uma conversa

```
Visitante no site do cliente
        │
        │  <script src="your-domain.com/widget.js" data-token="your_token_here">
        ▼
   widget.js (navegador)
        │
        ├─ POST /api/chat/start
        │      ├─ Valida token → identifica o site
        │      ├─ Verifica limite mensal de conversas
        │      └─ Cria sessão → retorna welcomeMessage
        │
        └─ POST /api/chat/message  (a cada mensagem)
               ├─ Valida sessão ativa
               ├─ Incrementa contador (guardrail de custo)
               ├─ [paralelo] chatModel   → resposta conversacional
               │  [paralelo] extractModel → extrai dados estruturados
               ├─ Valida contato brasileiro (server-side)
               ├─ Acumula dados na sessão (JSONB merge)
               └─ Se qualificado (nome + projeto + contato):
                      ├─ Salva lead no banco
                      ├─ Gera URL WhatsApp pré-preenchida
                      └─ Envia e-mail de notificação (assíncrono)
```

---

## Fluxo do painel admin

```
Navegador (admin)
        │
        │  /admin/*  →  React SPA servida pelo Fastify
        ▼
  LoginPage
        │  POST /api/admin/auth/login
        │  └─ bcrypt.compare → JWT (8h)
        ▼
  AdminLayout (sidebar)
        ├─ /admin/clients      → CRUD de sites/clientes
        ├─ /admin/clients/:id  → Visão detalhada por site
        ├─ /admin/leads        → Leads com filtros + CSV
        ├─ /admin/sessions     → Histórico de conversas + replay
        └─ /admin/dashboard    → KPIs + gráficos (últimos 30 dias)
```

---

## Estrutura de arquivos

```
op-chatbot/
├── src/
│   ├── server.ts              # Fastify: registra plugins, rotas, static files
│   ├── config.ts              # Lê e valida variáveis de ambiente
│   ├── types.ts               # Interfaces TypeScript compartilhadas
│   ├── db/
│   │   ├── pool.ts            # Pool PostgreSQL compartilhado
│   │   ├── schema.sql         # Schema principal (chat)
│   │   ├── migrate.ts         # Runner do schema principal
│   │   ├── admin_migration.sql# Schema admin (admin_users, colunas extras)
│   │   └── admin_migrate.ts   # Runner do schema admin + seed do usuário
│   ├── services/
│   │   ├── database.ts        # Queries do chat (sessions, messages, leads)
│   │   ├── adminDatabase.ts   # Queries do painel admin
│   │   ├── llm.ts             # Abstração do LLM (chat + extração)
│   │   └── email.ts           # Notificação de leads por e-mail
│   ├── middleware/
│   │   └── adminAuth.ts       # preHandler JWT para rotas admin
│   ├── routes/
│   │   ├── chat.ts            # /api/chat/start e /api/chat/message
│   │   └── admin/
│   │       ├── auth.ts        # /api/admin/auth/*
│   │       ├── sites.ts       # /api/admin/sites/*
│   │       ├── leads.ts       # /api/admin/leads/*
│   │       ├── sessions.ts    # /api/admin/sessions/*
│   │       └── dashboard.ts   # /api/admin/dashboard
│   └── widget/
│       └── index.ts           # Widget (TypeScript vanilla → widget.js)
│
├── admin/                     # Painel admin (React 18 + Vite + shadcn/ui)
│   └── src/
│       ├── api/               # Chamadas axios para o backend (puro TS, sem dependência de framework)
│       ├── components/
│       │   ├── ui/            # Componentes shadcn/ui (Button, Dialog, Table, Select, etc.)
│       │   ├── layout/        # AdminLayout com sidebar escura
│       │   └── clients/       # ClientFormDialog, ConfirmDialog, TokenDisplay
│       ├── hooks/             # useSites, useLeads, useSessions (React custom hooks)
│       ├── pages/             # Uma página por rota (LoginPage, ClientsPage, etc.)
│       ├── stores/            # Zustand (auth)
│       ├── types/             # Interfaces TypeScript do frontend
│       ├── lib/               # utils.ts (função cn() do Tailwind)
│       ├── App.tsx            # React Router + guards de autenticação
│       └── main.tsx           # Bootstrap: BrowserRouter + Toaster
│
├── public/
│   ├── widget.js              # Widget compilado (gerado, não versionado)
│   └── admin/                 # SPA admin compilada (gerada, não versionada)
│
├── docs/                      # Esta documentação
├── deploy/
│   └── nginx.conf             # Configuração Nginx (template)
├── docker-compose.yml         # Produção (VPS)
├── Dockerfile                 # Imagem Docker
└── .env.example               # Template de variáveis de ambiente
```

---

## Componentes e responsabilidades

### Backend (Fastify)

- **Servidor único** na porta 3001 (mapeada para 3050 no Docker)
- Serve o widget.js como arquivo estático em `/widget.js`
- Serve o painel admin em `/admin/*` (SPA com catch-all para React Router)
- Rotas de chat: validação, LLM, acumulação de dados, qualificação
- Rotas admin: JWT-protected, CRUD completo

### Banco de dados (PostgreSQL)

- `sites` — clientes cadastrados
- `sessions` — conversas (estado + dados acumulados em JSONB)
- `messages` — histórico de mensagens (contexto para o LLM)
- `leads` — leads qualificados
- `admin_users` — usuários do painel admin

### Widget (browser)

- TypeScript vanilla compilado com esbuild
- Zero dependências externas
- Injetado via uma única `<script>` tag no site do cliente
- Gerencia toda a UI: botão flutuante, painel, bolha proativa
- Persiste `sessionId` no `sessionStorage`

### Admin (React 18 + shadcn/ui)

- SPA servida pelo mesmo processo Fastify em `/admin/*`
- Build gerado em `public/admin/` via `npm run build:admin` (Vite)
- Em desenvolvimento: servidor Vite separado na porta `5173` com proxy para `localhost:3001`
- Comunicação exclusiva via `/api/admin/*`
- Autenticação por JWT (8h), armazenado no `localStorage`
- Estado global com Zustand (auth store)
- Roteamento com React Router v6 — history mode com `basename="/admin"`
- Componentes visuais: shadcn/ui (Radix UI primitivos + Tailwind CSS)
- Gráficos: Recharts
- Formulários: React Hook Form + Zod

---

## Decisões técnicas relevantes

**Dois modelos LLM em paralelo**
Cada mensagem faz dois calls simultâneos: um para gerar a resposta conversacional, outro para extrair dados estruturados em JSON. Elimina latência sequencial sem aumentar custo.

**JSONB merge para dados acumulados**
Os dados do lead são acumulados na sessão usando o operador `||` do PostgreSQL (JSONB merge). Campos já preenchidos não são sobrescritos — garante que dados de mensagens anteriores não se percam.

**Widget servido pelo backend**
O `widget.js` é compilado junto com o backend e servido estaticamente. Atualizar a interface é só fazer deploy do backend — sem tocar nos sites clientes.

**Pool compartilhado**
`src/db/pool.ts` exporta um único `Pool` PostgreSQL usado tanto pelo `database.ts` (chat) quanto pelo `adminDatabase.ts` (admin). Evita múltiplas conexões abertas.
