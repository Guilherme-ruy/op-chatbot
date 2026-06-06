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

**`extractModel`** — lê apenas a mensagem atual e extrai os campos configurados para o site:
```json
{
  "nome_do_visitante":        "João Silva",
  "tipo_de_servico":          "site",
  "pessoa_fisica_ou_empresa": "pj",
  "cnpj":                     null,
  "whatsapp_ou_e_mail":       "11987654321",
  "qualified":                false
}
```

> As chaves do JSON correspondem exatamente a `site_fields.key` — são diferentes para cada site.

Usar dois modelos em paralelo elimina a latência sequencial: o tempo total é o do mais lento (não a soma dos dois).

---

## Configuração

```env
LLM_API_KEY=sua_chave_de_api
LLM_MODEL=gemini-2.0-flash-lite
```

O modelo é configurável via `LLM_MODEL` sem alterar código. O padrão `gemini-2.0-flash-lite` é escolhido pelo custo-benefício: respostas rápidas e baratas para conversas curtas de qualificação.

---

## Parâmetros de geração

| Parâmetro | chatModel | extractModel |
|---|---|---|
| `temperature` | 0.7 (criativo) | 0.1 (determinístico) |
| `maxOutputTokens` | 150 | — |
| `responseMimeType` | text | `application/json` |

O `extractModel` usa JSON Schema **dinâmico** gerado a partir dos campos configurados no site:

```typescript
// buildExtractSchema(fields: SiteField[]) → schema dinâmico
{
  type: OBJECT,
  properties: {
    // uma propriedade por SiteField, tipo STRING nullable
    nome_do_visitante:        STRING (nullable),
    tipo_de_servico:          STRING (nullable),
    whatsapp_ou_e_mail:       STRING (nullable),
    // ... outros campos configurados
    qualified: BOOLEAN
  }
}
```

---

## Prompts dinâmicos

Os system prompts são gerados em tempo de execução a partir dos campos (`SiteField[]`) configurados para cada site — **não há strings hardcoded** de tipo de serviço ou campos fixos.

### `buildChatSystemPrompt(fields, accumulated)`

Gera instruções para o `chatModel`:
- Lista numerada dos campos a coletar, com label + hint de cada campo
- Regras de comportamento (uma pergunta por vez, não repetir, redirecionar)
- Validação de contato brasileiro (somente se houver campo de contato configurado)
- Seção "dados já coletados" para evitar repetições
- Condição de encerramento baseada nos campos `required`

### `buildExtractSystemPrompt(fields)`

Gera instruções para o `extractModel`:
- Lista de campos a extrair com suas chaves e descrições
- Nota de atenção com a chave correta do campo de contato (detectada dinamicamente)

---

## Qualificação de um lead

Um lead é considerado qualificado quando:

1. O `extractModel` retorna `qualified: true`, **ou**
2. O acumulador da sessão tem todos os campos `required` preenchidos

A verificação de obrigatoriedade é feita por `isLeadQualified(accumulated, fields)` que itera sobre os campos com `required: true` do site.

### Extração final

Ao qualificar, o sistema faz uma terceira chamada (`extractFromHistory`) que varre **todas** as mensagens do usuário na sessão:

```typescript
const combined = userMessages.join('\n---\n')
// "Analise TODAS as mensagens e extraia os dados encontrados em qualquer uma delas..."
```

Garante que um nome dito na primeira mensagem não se perca se a sessão tiver um erro de 503 no meio.

---

## Validação de telefone (server-side)

Aplicada apenas quando há um campo cujo `key` seja `whatsapp_ou_e_mail`, `contact`, ou contenha `contato` / `whatsapp`. O backend valida o número **antes** de aceitar e acumular:

| Dígitos | Situação | Ação |
|---|---|---|
| 11 | Celular com DDD | ✅ Aceito |
| 10 (3° dígito ≠ 9) | Fixo com DDD | ✅ Aceito |
| 10 (3° dígito = 9) | Celular incompleto | ❌ Pede confirmação |
| 9 (começa com 9) | Celular sem DDD | ❌ Pede DDD |
| 8 | Fixo sem DDD | ❌ Pede DDD |
| E-mail | — | ✅ Aceito diretamente |

Se inválido: a mensagem do bot é substituída por uma solicitação de correção, o campo de contato não é acumulado.

---

## Fallbacks de erro

| Erro | Comportamento |
|---|---|
| 503 / overload | Pede para o usuário tentar novamente (conversa preservada) |
| 429 / quota | Redireciona para WhatsApp com mensagem de fallback |
| Erro genérico | Re-lança para o error handler global do Fastify |

---

## Assinaturas exportadas

```typescript
// Verificação de qualificação
isLeadQualified(accumulated: Record<string, string|null>, fields: SiteField[]): boolean

// Conversa principal (dois LLM em paralelo)
chat(history, userMessage, accumulated, fields: SiteField[]): Promise<LLMResponse>

// Extração final sobre todo o histórico
extractFromHistory(userMessages: string[], fields: SiteField[]): Promise<Record<string, string|null>>

// URL de WhatsApp com dados do lead
buildWhatsAppUrl(customData, fields: SiteField[], waNumber, botName): string

// URL de fallback quando o LLM falha
buildFallbackWhatsAppUrl(waNumber, siteName): string
```

---

## Como trocar de provedor

1. **Instalar o SDK do novo provedor:**
   ```bash
   npm install @openai/openai  # exemplo com OpenAI
   ```

2. **Reescrever `src/services/llm.ts`** mantendo as mesmas assinaturas exportadas acima.

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
