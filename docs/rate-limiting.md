# Rate Limiting

O sistema tem dois níveis de limitação: um **global** (por IP) e um **por site** (limite mensal configurado no painel).

---

## Nível 1 — Global (por IP)

Aplicado a todas as rotas da API.

| Limite | Janela |
|---|---|
| 60 requisições | 1 minuto |

Configurado via `@fastify/rate-limit` em `src/server.ts`.

**Exceção:** o endpoint de login admin tem limite próprio mais restritivo:

| Limite | Janela |
|---|---|
| 5 tentativas | 15 minutos |

Proteção contra brute-force de senha.

---

## Nível 2 — Por site (limite mensal de conversas)

Configurado individualmente por site no painel admin.

### Como funciona

Ao iniciar uma nova conversa (`POST /api/chat/start`):

1. Sistema verifica se o site tem `monthly_session_limit` definido
2. Conta quantas sessões o site abriu no mês corrente
3. Se `sessões_do_mês >= limite` → bloqueia com HTTP 429
4. Caso contrário → cria a sessão normalmente

```
site.monthly_session_limit = NULL  →  sem limite (ilimitado)
site.monthly_session_limit = 0     →  sem limite (ilimitado)
site.monthly_session_limit = 100   →  máximo 100 conversas/mês
```

### Renovação

O contador reinicia automaticamente no dia 1 de cada mês. Não há intervenção manual necessária — a contagem usa `DATE_TRUNC('month', NOW())` na query.

### Comportamento do widget quando o limite é atingido

**HTTP 429** é retornado com:
```json
{
  "error": "Limite mensal de conversas atingido.",
  "limitReached": true,
  "whatsappUrl": "https://wa.me/5511999990000?text=...",
  "limitMessage": "Olá! No momento não conseguimos atender. Fale conosco pelo WhatsApp!"
}
```

O widget reage assim:
- O painel de chat fecha
- O botão flutuante **transforma-se em um botão de WhatsApp direto** — o visitante clica e já abre a conversa no WhatsApp
- Se `limitMessage` estiver configurado, aparece na **bolha proativa** acima do botão
- Se nenhum número de WhatsApp estiver configurado, o widget some completamente
- Nenhum custo de LLM é gerado

### Monitoramento no painel

No **Dashboard** ou **Visão por site**, o card "Uso mensal" exibe:
- Conversas usadas vs. limite do mês atual
- Barra de progresso com cor adaptável (verde / laranja / vermelho)
- Data de renovação (dia 1 do próximo mês)
- Nota informativa: ao atingir 100%, o widget exibe apenas o botão de WhatsApp

---

## Configurar o limite de um site

No painel admin → Sites → menu de ações → **Editar**:

- **Limite mensal de conversas:** número inteiro positivo. Deixar vazio ou `0` = ilimitado.
- **Mensagem ao atingir o limite:** texto exibido na bolha do widget quando o limite é atingido (máx. 500 chars). Opcional — se vazio, o botão de WhatsApp aparece sem mensagem.

---

## Índice de banco de dados

Para que a contagem mensal seja rápida mesmo com muitas sessões:

```sql
CREATE INDEX idx_sessions_site_month ON sessions(site_id, created_at);
```

A query de contagem é:
```sql
SELECT COUNT(*)::int FROM sessions
WHERE site_id = $1
  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
```

---

## Nível 3 — Guardrail de custo por sessão

Independente do limite de conversas, cada sessão tem um limite de mensagens trocadas (padrão: 20). Quando atingido:

- A sessão é marcada como `abandoned`
- O visitante recebe um link WhatsApp de fallback
- Evita sessões infinitas e custo excessivo de LLM

Configurável via `MAX_MESSAGES_PER_SESSION` no `.env`.
