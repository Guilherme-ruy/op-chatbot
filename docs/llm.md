# Camada LLM

O sistema usa dois modelos de linguagem em paralelo por mensagem, abstraídos em `src/services/llm.ts`. O provedor atual é o **Google Gemini**, mas a arquitetura permite troca sem alterar o restante do sistema.

---

## Como funciona

### Dois modelos em paralelo

A cada mensagem do visitante, dois calls são feitos simultaneamente:

```
Mensagem do usuário
        │
        ├─ chatModel    → resposta conversacional (texto livre)
        └─ extractModel → extração estruturada (JSON)
```

**`chatModel`** — responde ao usuário de forma natural, guiado pelo system prompt. Conhece os dados já coletados para não repetir perguntas.

**`extractModel`** — lê apenas a mensagem atual e extrai campos estruturados:
```json
{
  "name": "João",
  "projectType": "site",
  "clientType": "pj",
  "cnpj": null,
  "contact": "11987654321",
  "budget": "R$ 5.000",
  "qualified": false
}
```

Usar dois modelos em paralelo elimina a latência sequencial: o tempo total é o do mais lento (não a soma dos dois).

---

## Configuração

```env
LLM_API_KEY=sua_chave_de_api
LLM_MODEL=gemini-3.1-flash-lite
```

O modelo é configurável via `LLM_MODEL` sem alterar código. O padrão `gemini-3.1-flash-lite` é escolhido pelo custo-benefício: respostas rápidas e baratas para conversas curtas de qualificação.

---

## Parâmetros de geração

| Parâmetro | chatModel | extractModel |
|---|---|---|
| `temperature` | 0.7 (criativo) | 0.1 (determinístico) |
| `maxOutputTokens` | 150 | — |
| `responseMimeType` | text | `application/json` |

O `extractModel` usa JSON Schema para garantir a estrutura da resposta:

```typescript
responseSchema: {
  type: OBJECT,
  properties: {
    name, projectType, clientType, cnpj, contact, budget: STRING (nullable)
    qualified: BOOLEAN
  }
}
```

---

## Qualificação de um lead

Um lead é considerado qualificado quando:

1. O `extractModel` retorna `qualified: true`, **ou**
2. O acumulador da sessão tem `name + projectType + contact` preenchidos

A segunda condição existe como segurança — o acumulador é a fonte de verdade mais confiável (dados de mensagens anteriores são preservados mesmo que o modelo falhe pontualmente).

### Extração final

Ao qualificar, o sistema faz uma terceira chamada (`extractFromHistory`) que varre **todas** as mensagens do usuário na sessão:

```typescript
const combined = userMessages.join('\n---\n')
// "Analise TODAS as mensagens e extraia os dados..."
```

Garante que um nome dito na primeira mensagem não se perca se a sessão tiver um erro de 503 no meio.

---

## Validação de telefone (server-side)

O backend valida o número de telefone **antes** de aceitar e acumular:

| Dígitos | Situação | Ação |
|---|---|---|
| 11 | Celular com DDD | ✅ Aceito |
| 10 (3° dígito ≠ 9) | Fixo com DDD | ✅ Aceito |
| 10 (3° dígito = 9) | Celular incompleto | ❌ Pede confirmação |
| 9 (começa com 9) | Celular sem DDD | ❌ Pede DDD |
| 8 | Fixo sem DDD | ❌ Pede DDD |
| E-mail | — | ✅ Aceito diretamente |

Se inválido: a mensagem do bot é substituída por uma solicitação de correção, o campo `contact` não é acumulado.

---

## Fallbacks de erro

| Erro | Comportamento |
|---|---|
| 503 / overload | Pede para o usuário tentar novamente (conversa preservada) |
| 429 / quota | Redireciona para WhatsApp com mensagem de fallback |
| Erro genérico | Re-lança para o error handler global do Fastify |

---

## Como trocar de provedor

1. **Instalar o SDK do novo provedor:**
   ```bash
   npm install @openai/openai  # exemplo com OpenAI
   ```

2. **Reescrever `src/services/llm.ts`** mantendo as mesmas assinaturas exportadas:
   - `chat(history, userMessage, accumulated)` → `Promise<LLMResponse>`
   - `extractFromHistory(userMessages)` → `Promise<Partial<LLMResponse['collected']>>`
   - `buildWhatsAppUrl(collected, siteName, waNumber)` → `string`
   - `buildFallbackWhatsAppUrl(waNumber, siteName)` → `string`

3. **Atualizar `.env`:**
   ```env
   LLM_API_KEY=nova_chave
   LLM_MODEL=novo-modelo
   ```

4. **Nada mais precisa mudar** — `chat.ts` e o resto do sistema não sabem qual provedor está sendo usado.

---

## Custo estimado (Gemini Flash Lite)

Com conversas médias de 7 mensagens e tokens reduzidos (`maxOutputTokens: 150`):

- ~14 calls por sessão (7 mensagens × 2 modelos)
- Custo por sessão: frações de centavo
- Limite de 20 mensagens por sessão garante custo máximo previsível

Monitore a cota no painel do Google AI Studio.
