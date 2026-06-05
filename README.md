# op-chatbot

Chatbot de qualificação de leads para agências web. Integra em qualquer site via uma única tag `<script>` e usa LLM para conduzir conversas em português, coletar dados do visitante e entregar o lead qualificado via WhatsApp e e-mail.

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-22%2B-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## O que faz

O visitante chega ao site do cliente → o widget aparece automaticamente → uma conversa guiada por LLM coleta nome, tipo de projeto e contato → quando o lead está qualificado, o input desaparece, um botão de WhatsApp pré-preenchido é exibido e uma notificação chega por e-mail.

Tudo isso sem nenhuma modificação no site do cliente além de uma tag `<script>`.

---

## Funcionalidades

- **Widget embeddable** — instalação com uma única linha de HTML
- **LLM conversacional** — dois modelos em paralelo: um responde, outro extrai dados estruturados
- **Qualificação automática** — detecta quando nome + projeto + contato estão preenchidos
- **WhatsApp pré-preenchido** — link gerado com os dados do lead ao qualificar
- **Notificação por e-mail** — disparo automático ao qualificar o lead
- **Painel admin** — gerenciamento de clientes, leads, sessões e dashboard com KPIs
- **Multi-site** — um backend serve múltiplos clientes, cada um com token próprio
- **Rate limiting por plano** — limite mensal de conversas configurável por cliente
- **Exportação CSV** — leads filtrados exportáveis diretamente pelo painel

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Fastify 4 + TypeScript |
| Banco | PostgreSQL 17 |
| LLM | Google Gemini (configurável) |
| Widget | TypeScript vanilla → esbuild |
| Admin | React 18 + Vite + shadcn/ui + Tailwind |
| Deploy | Docker + Nginx |

---

## Quick Start

```bash
# 1. Clonar e instalar dependências
git clone https://github.com/your-username/op-chatbot.git
cd op-chatbot
npm install
cd admin && npm install && cd ..

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com suas chaves (LLM, banco, SMTP, ADMIN_EMAIL, ADMIN_PASSWORD)

# 3. Criar o usuário admin (apenas uma vez)
npm run db:admin-migrate

# 4. Rodar em desenvolvimento
npm run dev          # backend na porta 3001 — schema aplicado automaticamente
npm run dev:admin    # painel admin na porta 5173
```

Acesse o painel em `http://localhost:5173/admin/` e a API em `http://localhost:3001`.

> Guia completo de instalação: [docs/setup.md](./docs/setup.md)

---

## Testando localmente

Com o servidor rodando (`npm run dev`), há duas formas de testar o widget:

1. Acesse `http://localhost:5173/admin/` e crie um cliente com domínio `localhost:3001`
2. Copie o token gerado e cole em `examples/test-site.html` no lugar de `SEU_TOKEN_AQUI`
3. Acesse `http://localhost:3001/test.html`

> O domínio cadastrado no admin é validado a cada requisição — o widget só funciona quando carregado a partir desse domínio exato. Por isso use `localhost:3001` para testes locais.

---

## Instalação do widget

Cole antes de `</body>` no site do cliente:

```html
<script
  src="https://your-domain.com/widget.js"
  data-token="TOKEN_DO_CLIENTE"
  defer
></script>
```

O token é gerado automaticamente ao cadastrar o cliente no painel admin.

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [docs/setup.md](./docs/setup.md) | Instalação e primeira execução |
| [docs/environment.md](./docs/environment.md) | Todas as variáveis de ambiente |
| [docs/architecture.md](./docs/architecture.md) | Arquitetura e fluxo de dados |
| [docs/database.md](./docs/database.md) | Schema do banco de dados |
| [docs/widget.md](./docs/widget.md) | Como instalar e personalizar o widget |
| [docs/admin-panel.md](./docs/admin-panel.md) | Guia do painel administrativo |
| [docs/llm.md](./docs/llm.md) | Camada LLM e como trocar de provedor |
| [docs/rate-limiting.md](./docs/rate-limiting.md) | Rate limiting por site |
| [docs/api/chat.md](./docs/api/chat.md) | Endpoints do widget |
| [docs/api/admin.md](./docs/api/admin.md) | Endpoints do painel admin |
| [deploy/DEPLOY.md](./deploy/DEPLOY.md) | Guia de deploy em produção |

---

## Licença

MIT © [Guilherme Ruy](https://guilhermeruy.com.br)
