# op-chatbot — Documentação

Chatbot de qualificação de leads para agências web. Integra em qualquer site via uma única tag `<script>` e usa LLM para conduzir conversas em português e extrair dados estruturados do visitante.

---

## Índice

| Arquivo | O que cobre |
|---|---|
| [setup.md](./setup.md) | Instalação local e primeira execução |
| [environment.md](./environment.md) | Todas as variáveis de ambiente |
| [architecture.md](./architecture.md) | Fluxo geral, stack e como os componentes se conectam |
| [database.md](./database.md) | Schema completo do banco de dados |
| [api/chat.md](./api/chat.md) | Endpoints do widget (`/api/chat/*`) |
| [api/admin.md](./api/admin.md) | Endpoints do painel admin (`/api/admin/*`) |
| [widget.md](./widget.md) | Como instalar e atualizar o widget |
| [admin-panel.md](./admin-panel.md) | Guia de uso do painel administrativo |
| [rate-limiting.md](./rate-limiting.md) | Sistema de rate limit por site |
| [llm.md](./llm.md) | Camada de LLM e como trocar de provedor |

---

## Visão rápida

```
visitante
  └─ widget.js (carregado pelo site do cliente)
       └─ POST /api/chat/start    → valida token + verifica limite mensal
       └─ POST /api/chat/message  → LLM responde + extrai dados do lead
            └─ lead qualificado → e-mail de notificação + link WhatsApp

admin
  └─ /admin (painel React + shadcn/ui)
       └─ Sites, Leads, Sessões, Dashboard, Configurações, Visão por site
```

---

## Stack resumida

| Camada | Tecnologia |
|---|---|
| Backend | Fastify 4 + TypeScript |
| Banco | PostgreSQL 17 |
| LLM | Google Gemini (via `src/services/llm.ts`) |
| Widget | TypeScript vanilla → esbuild |
| Admin | React 18 + Vite + shadcn/ui + Tailwind + Zustand |
| Infra | Docker + Nginx |
