# Widget

## O que é

O widget é o componente visual do chatbot — botão flutuante, painel de conversa e bolha proativa. Escrito em TypeScript vanilla e compilado para um único arquivo JavaScript:

```
src/widget/index.ts  →  esbuild  →  public/widget.js
```

Servido em: `https://your-domain.com/widget.js`

---

## Instalação no site do cliente

Cole antes de `</body>`:

```html
<script
  src="https://your-domain.com/widget.js"
  data-token="TOKEN_DO_CLIENTE"
  defer
></script>
```

O token é gerado automaticamente ao criar o cliente no painel admin. Cada site tem seu próprio token.

---

## Como funciona

Quando o navegador carrega o `widget.js`:

1. Injeta todo o CSS da interface na página
2. Cria o botão flutuante verde (canto inferior direito)
3. Após 15–32s, exibe uma bolha proativa com mensagem aleatória
4. Ao clicar, abre o painel de conversa
5. Inicia sessão via `POST /api/chat/start` com o token
6. Mantém o `sessionId` no `sessionStorage` durante a visita

---

## Fluxo no navegador

```
Página carrega
     │
     ▼
widget.js lê data-token do <script>
     │
     ▼  (após 15-32s)
Bolha proativa aparece
     │
     ▼  (clique no botão ou na bolha)
Painel abre → POST /api/chat/start
     │
     ├─ 429 (limite atingido) → mensagem de indisponibilidade + botão WhatsApp
     └─ 200 → exibe welcome message, habilita input
          │
          ▼  (usuário digita)
     POST /api/chat/message
          │
          ├─ qualified: false → bot faz mais perguntas
          └─ qualified: true  → oculta input, exibe botão WhatsApp
```

---

## Comportamentos especiais

**Limite mensal atingido (429)**
Se o site esgotou o limite de conversas do mês, o widget exibe uma mensagem amigável e um botão direto para o WhatsApp. Nenhum custo de LLM é gerado.

**Sessão expirada**
Se a API retornar 400 ou 404, o widget remove o `sessionId` do `sessionStorage` e inicia uma nova sessão automaticamente.

**Lead qualificado**
Quando o visitante fornece nome + tipo de projeto + contato válido, o input desaparece e um botão verde "Falar com a equipe" com link WhatsApp pré-preenchido é exibido.

---

## Atualizar a interface

Mudanças visuais são feitas **somente no backend** — os sites clientes não precisam ser tocados:

```bash
# 1. Editar o widget
# src/widget/index.ts

# 2. Commitar e subir
git add src/widget/index.ts
git commit -m "feat: descrição da mudança"
git push

# 3. Deploy na VPS
cd /opt/op-chatbot
git pull
docker compose up -d --build
```

Todos os clientes recebem a atualização automaticamente após o deploy.

---

## Build local

```bash
npm run build:widget   # compila widget.js (desenvolvimento)
npm run dev            # watch mode: recompila ao salvar
```

---

## Personalização por site

O visual base (cores, layout, textos de sistema) é o mesmo para todos os sites. O que varia por site:

| Campo | Configurado em |
|---|---|
| Nome do bot | `bot_name` na tabela `sites` |
| Avatar do bot | `bot_avatar_url` na tabela `sites` |
| Token de identificação | `token` na tabela `sites` |

Personalizações mais profundas (tema por cliente, mensagens customizadas) estão no roadmap.
