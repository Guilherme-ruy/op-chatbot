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
               ├─ Carrega site_fields do site
               ├─ Incrementa contador (guardrail de custo)
               ├─ [paralelo] chatModel   → resposta conversacional (prompt dinâmico)
               │  [paralelo] extractModel → extrai campos configurados (schema dinâmico)
               ├─ Valida contato brasileiro (server-side, se campo de contato configurado)
               ├─ Acumula dados na sessão (JSONB merge, chaves = site_fields.key)
               └─ Se todos os campos required preenchidos:
                      ├─ Salva lead (custom_data + colunas indexadas)
                      ├─ Gera URL WhatsApp com todos os campos coletados
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
        ├─ /admin/clients       → CRUD de sites
        ├─ /admin/clients/:id   → Visão detalhada por site (gráficos, leads, token)
        ├─ /admin/leads         → Leads com filtros + CSV
        ├─ /admin/sessions      → Histórico de conversas + replay
        ├─ /admin/dashboard     → KPIs + gráficos com seletor de site e período
        └─ /admin/config        → Campos de coleta configuráveis por site
```

---

## Estrutura de arquivos

```
op-chatbot/
├── src/
│   ├── server.ts              # Fastify: registra plugins, rotas, static files
│   ├── config.ts              # Lê e valida variáveis de ambiente
│   ├── types.ts               # Interfaces TypeScript compartilhadas (incl. SiteField)
│   ├── db/
│   │   ├── pool.ts            # Pool PostgreSQL compartilhado
│   │   ├── schema.sql         # Schema principal (sites, sessions, messages, leads, site_fields)
│   │   ├── migrate.ts         # Runner do schema principal
│   │   ├── admin_migration.sql# Colunas extras + site_fields + migração de dados
│   │   ├── admin_migrate.ts   # Runner do schema admin + seed do usuário
│   │   └── autoMigrate.ts     # Auto-migration na inicialização (schema + admin)
│   ├── services/
│   │   ├── database.ts        # Queries do chat (sessions, messages, leads, site_fields)
│   │   ├── adminDatabase.ts   # Queries do painel admin (CRUD sites, leads, site_fields)
│   │   ├── llm.ts             # Abstração do LLM (prompts dinâmicos, chat, extração)
│   │   └── email.ts           # Notificação de leads (template dinâmico por campos)
│   ├── middleware/
│   │   └── adminAuth.ts       # preHandler JWT para rotas admin
│   ├── routes/
│   │   ├── chat.ts            # /api/chat/start e /api/chat/message
│   │   └── admin/
│   │       ├── auth.ts        # /api/admin/auth/*
│   │       ├── sites.ts       # /api/admin/sites/*
│   │       ├── fields.ts      # /api/admin/sites/:id/fields/* (CRUD + reorder + reset)
│   │       ├── leads.ts       # /api/admin/leads/*
│   │       ├── sessions.ts    # /api/admin/sessions/*
│   │       ├── dashboard.ts   # /api/admin/dashboard
│   │       └── upload.ts      # /api/admin/upload/avatar
│   └── widget/
│       └── index.ts           # Widget (TypeScript vanilla → widget.js)
│
├── admin/                     # Painel admin (React 18 + Vite + shadcn/ui)
│   └── src/
│       ├── api/
│       │   ├── client.ts      # Axios com interceptor JWT
│       │   ├── sites.ts       # CRUD de sites + stats + avatar
│       │   ├── fields.ts      # CRUD de campos (site_fields)
│       │   ├── leads.ts       # Listagem + export CSV
│       │   └── sessions.ts    # Listagem + mensagens
│       ├── components/
│       │   ├── ui/            # shadcn/ui (Button, Dialog, Table, Select, Switch, Textarea…)
│       │   ├── layout/        # AdminLayout com sidebar escura
│       │   └── clients/       # ClientFormDialog, ConfirmDialog, TokenDisplay
│       ├── hooks/             # useSites, useLeads, useSessions
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── ClientsPage.tsx     # Lista de sites com filtro de status
│       │   ├── SiteDetailPage.tsx  # KPIs + gráficos + código de instalação
│       │   ├── LeadsPage.tsx       # Leads com custom_data dinâmico
│       │   ├── SessionsPage.tsx    # Histórico + replay de conversas
│       │   ├── DashboardPage.tsx   # Seletor de site + período + KPIs
│       │   └── ConfigPage.tsx      # Campos de coleta configuráveis por site
│       ├── stores/            # Zustand (auth)
│       ├── types/             # Interfaces TypeScript (Site, Lead, SiteField…)
│       ├── lib/               # utils.ts (cn())
│       ├── App.tsx            # React Router + guards de autenticação
│       └── main.tsx           # Bootstrap
│
├── public/
│   ├── widget.js              # Widget compilado (gerado, não versionado)
│   └── admin/                 # SPA admin compilada (gerada, não versionada)
│
├── uploads/
│   └── avatars/               # Avatares dos bots (volume Docker: avatars)
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
- Serve os uploads de avatares em `/uploads/`
- Serve o painel admin em `/admin/*` (SPA com catch-all para React Router)
- Rotas de chat: validação, campos dinâmicos, LLM, acumulação, qualificação
- Rotas admin: JWT-protected, CRUD completo

### Banco de dados (PostgreSQL)

- `sites` — clientes cadastrados
- `site_fields` — campos de coleta configuráveis por site
- `sessions` — conversas (estado + dados acumulados em JSONB)
- `messages` — histórico de mensagens (contexto para o LLM)
- `leads` — leads qualificados (colunas indexadas + `custom_data` JSONB)
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

---

## Decisões técnicas relevantes

**Campos de coleta dinâmicos por site**
Os prompts do LLM (system prompt do chat + schema de extração JSON) são gerados em tempo de execução a partir dos `site_fields` configurados. Isso elimina qualquer string hardcoded de tipo de serviço e permite que cada site colete exatamente o que precisa.

**Dois modelos LLM em paralelo**
Cada mensagem faz dois calls simultâneos: um para gerar a resposta conversacional, outro para extrair dados estruturados em JSON. Elimina latência sequencial sem aumentar custo.

**JSONB merge para dados acumulados**
Os dados do lead são acumulados na sessão usando o operador `||` do PostgreSQL (JSONB merge). Campos já preenchidos não são sobrescritos — garante que dados de mensagens anteriores não se percam.

**`custom_data` como fonte de verdade**
`leads.custom_data` armazena o snapshot completo de todos os campos coletados. As colunas específicas (`name`, `contact`, etc.) são populadas por mapeamento de chaves conhecido para compatibilidade e performance de consulta.

**Widget servido pelo backend**
O `widget.js` é compilado junto com o backend e servido estaticamente. Atualizar a interface é só fazer deploy do backend — sem tocar nos sites clientes.

**Pool compartilhado**
`src/db/pool.ts` exporta um único `Pool` PostgreSQL usado tanto pelo `database.ts` (chat) quanto pelo `adminDatabase.ts` (admin). Evita múltiplas conexões abertas.
