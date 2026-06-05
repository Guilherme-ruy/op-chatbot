# Setup — Instalação e Primeira Execução

## Pré-requisitos

- Node.js 22+
- PostgreSQL 17 (local via pgAdmin ou via Docker)
- Docker + Docker Compose (apenas para deploy)
- Git

---

## 1. Clonar e instalar dependências

```bash
git clone https://github.com/your-username/op-chatbot.git
cd op-chatbot

# Backend
npm install

# Admin panel
cd admin && npm install && cd ..
```

---

## 2. Configurar variáveis de ambiente

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

Veja [environment.md](./environment.md) para a descrição de cada variável.

---

## 3. Banco de dados

### Opção A — PostgreSQL nativo (recomendado para dev)

Crie o role e o banco via `psql` ou pelo Query Tool do pgAdmin:

```sql
-- Criar role dedicado
CREATE ROLE chatbot_user WITH LOGIN PASSWORD 'your_password';

-- Criar banco
CREATE DATABASE chatbot_db OWNER chatbot_user;
GRANT ALL PRIVILEGES ON DATABASE chatbot_db TO chatbot_user;
```

Ajuste `DATABASE_URL` no `.env`:
```
DATABASE_URL=postgresql://chatbot_user:your_password@localhost:5432/chatbot_db
```

> **pgAdmin:** conecte em `localhost:5432` com o usuário `postgres` para criar a role e o banco graficamente.

### Opção B — PostgreSQL via Docker

Use o `docker-compose.override.yml` (presente no projeto, não versionado):

```bash
docker compose up postgres -d
```

A `DATABASE_URL` já está configurada no override — ajuste as credenciais conforme seu `.env`.

---

## 4. Criar o usuário admin

```bash
npm run db:admin-migrate
```

Usa `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env` para criar o usuário inicial do painel. Após rodar, `ADMIN_PASSWORD` pode ser removido do `.env`.

> **O schema do banco (tabelas, índices) é aplicado automaticamente** toda vez que o servidor sobe — não é necessário rodar `db:migrate` para o funcionamento básico.
>
> Execute `npm run db:migrate` apenas se quiser gerar um site de exemplo com token para testes rápidos.

---

## 5. Rodar em desenvolvimento

```bash
# Backend (porta 3001) + widget com watch
npm run dev

# Admin panel (porta 5173) — em outro terminal
npm run dev:admin
```

Acesse:
- **Chat API:** `http://localhost:3001`
- **Admin panel (dev):** `http://localhost:5173/admin/`
- **Admin panel (via backend):** `http://localhost:3001/admin`
- **Widget:** `http://localhost:3001/widget.js`

> Em desenvolvimento use a porta `5173` — tem hot reload (HMR). A rota `/admin` via backend serve o build estático.

---

## 6. Build de produção

```bash
# Compila tudo (widget + admin + backend)
npm run build:widget
npm run build:admin
npm run build

# Inicia o servidor compilado
npm start
```

---

## 7. Docker (produção)

```bash
# Build e subir
docker compose up -d --build

# Ver logs
docker compose logs -f op-chatbot

# Parar
docker compose down
```

O container expõe a porta `3050` mapeada para `3001` internamente.

---

## Comandos úteis

```bash
npm run dev              # backend + widget em modo watch
npm run dev:admin        # painel admin (Vite dev server)
npm run build:widget     # compila widget.js
npm run build:admin      # compila painel para public/admin/
npm run build            # compila TypeScript para dist/
npm run db:migrate       # schema principal
npm run db:admin-migrate # schema admin + seed do usuário admin
```
