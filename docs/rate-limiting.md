# Rate Limiting

O sistema tem dois níveis de limitação: um **global** (por IP) e um **por site** (por plano contratado).

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

Configurado individualmente por cliente no painel admin.

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

### Resposta quando o limite é atingido

**HTTP 429:**
```json
{
  "error": "Limite mensal de conversas atingido.",
  "limitReached": true,
  "whatsappUrl": "https://wa.me/5511999990000?text=..."
}
```

O widget exibe uma mensagem amigável ao visitante e um botão de WhatsApp como fallback. Nenhum custo de LLM é gerado.

### Alertas no painel

Na **Visão por site**, a barra de uso muda de cor conforme a ocupação:

| Uso | Cor | Ação recomendada |
|---|---|---|
| < 75% | 🟢 Verde | Normal |
| 75–89% | 🟡 Laranja | Monitorar |
| ≥ 90% | 🔴 Vermelho | Aumentar o limite ou o plano |

---

## Configurar o limite de um cliente

No painel admin → Clientes → menu de ações → **Editar**:

- **Nome do plano:** texto livre (ex: Básico, Pro, Empresarial)
- **Limite mensal de conversas:** número inteiro positivo. Deixar vazio = ilimitado.

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
