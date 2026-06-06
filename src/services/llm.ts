/**
 * Camada de abstração do modelo de linguagem (LLM).
 * Atualmente usa Google Gemini via @google/generative-ai.
 * Para trocar de provedor, altere apenas este arquivo e as variáveis de ambiente:
 *   LLM_API_KEY  — chave de API do provedor
 *   LLM_MODEL    — identificador do modelo (padrão: gemini-3.1-flash-lite)
 */
import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
} from '@google/generative-ai';
import { config } from '../config';
import type { LLMResponse, Message } from '../types';

const client = new GoogleGenerativeAI(config.llmApiKey);

// ── Model 1: Conversa (resposta livre ao usuário) ─────────────────────────────

const CHAT_SYSTEM_PROMPT_BASE = `
Você é um assistente virtual de qualificação de leads para uma agência digital especializada em criação de sites, sistemas web e hospedagem.

MISSÃO: Qualificar leads de forma rápida, amigável e conversacional em português brasileiro.

DADOS A COLETAR (um por vez, nessa ordem):
1. Nome do visitante
2. Tipo de projeto (site, sistema, hospedagem ou outro)
3. Pessoa física (PF) ou empresa (PJ)
4. Se PJ: CNPJ (não obrigatório — diga que é para personalizar a proposta)
5. WhatsApp ou e-mail de contato (UMA pergunta por vez, nunca junto com outra)
6. Orçamento estimado (opcional, pergunte só se a conversa fluir naturalmente)

REGRAS IMPORTANTES:
- Faça UMA pergunta por vez — nunca combine perguntas na mesma mensagem
- NÃO repita perguntas para dados que já foram fornecidos
- Respostas CURTAS: máximo 1 frase de resposta + 1 pergunta. Seja direto.
- APENAS sobre os serviços da empresa — se fugir do assunto, redirecione em 1 frase
- NÃO cite preços; NÃO responda perguntas técnicas profundas

VALIDAÇÃO DE TELEFONE BRASILEIRO:
Ao receber um número de contato, valide o formato antes de aceitar:
- Celular com DDD correto: 11 dígitos (ex: 11987654321 ou (11) 98765-4321)
- Fixo com DDD correto: 10 dígitos (ex: 1134567890 ou (11) 3456-7890)
- Celular sem DDD: 9 dígitos começando com 9 → peça o DDD: "Pode me informar o DDD também?"
- Fixo sem DDD: 8 dígitos → peça o DDD: "Pode me informar o DDD também?"
- 10 dígitos onde o 3º dígito é 9 (ex: 1198765432) → provavelmente celular com dígito faltando → confirme: "Só para não errar: seu celular é (XX) 9XXXX-XXXX? Parece que pode estar faltando um dígito."
- E-mail válido: aceite normalmente sem validação adicional

QUANDO ENCERRAR:
- Assim que tiver nome + tipo de projeto + contato VÁLIDO: agradeça em 1 frase e diga que a equipe entrará em contato em breve.
- NÃO peça mais nada após isso.
`.trim();

// O modelo de chat é criado dinamicamente para incluir o contexto acumulado
function createChatModel(accumulated: Record<string, string | null>) {
  const collected = Object.entries(accumulated)
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const systemInstruction = collected
    ? `${CHAT_SYSTEM_PROMPT_BASE}\n\nDADOS JÁ COLETADOS (NÃO PERGUNTE NOVAMENTE):\n${collected}`
    : CHAT_SYSTEM_PROMPT_BASE;

  return client.getGenerativeModel({
    model: config.llmModel,
    systemInstruction,
    generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
  });
}

// ── Model 2: Extração estruturada (só lê a mensagem atual) ────────────────────

const EXTRACT_SYSTEM_PROMPT = `
Você é um extrator de dados. Leia a mensagem e extraia SOMENTE o que está EXPLICITAMENTE escrito.
NUNCA invente, suponha ou infira valores. Se não tiver certeza absoluta, retorne null.

Campos:
- name: nome próprio de pessoa (ex: "Carlos", "Ana Lima"). Null se não houver nome claramente dito.
- projectType: normalize para "site" | "sistema" | "hospedagem" | "outro". Null se não mencionado.
- clientType: "pj" se disse empresa/PJ/CNPJ, "pf" se disse pessoa física/PF. Null se não mencionado.
- cnpj: CNPJ com 14 dígitos (com ou sem formatação). Null se não houver CNPJ.
- contact: número de telefone/WhatsApp (8-11 dígitos, com ou sem formatação) ou endereço de e-mail. Null se não houver.
- budget: valor monetário EXPLÍCITO com R$, reais ou similar (ex: "R$ 3.000", "uns 4000 reais", "5k"). Null se não mencionado — NUNCA extraia um número solto como orçamento.
- qualified: true APENAS se esta mensagem sozinha contiver nome + tipo de projeto + contato.

Atenção:
- Um número de telefone (8-11 dígitos) é "contact", NUNCA "budget" ou "cnpj".
- Um CNPJ tem exatamente 14 dígitos. Sequências menores não são CNPJ.
- Se em dúvida sobre qualquer campo, retorne null.
`.trim();

const extractModel = client.getGenerativeModel({
  model: config.llmModel,
  systemInstruction: EXTRACT_SYSTEM_PROMPT,
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1,
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        name:        { type: SchemaType.STRING, nullable: true },
        projectType: { type: SchemaType.STRING, nullable: true },
        clientType:  { type: SchemaType.STRING, nullable: true },
        cnpj:        { type: SchemaType.STRING, nullable: true },
        contact:     { type: SchemaType.STRING, nullable: true },
        budget:      { type: SchemaType.STRING, nullable: true },
        qualified:   { type: SchemaType.BOOLEAN },
      },
      required: ['qualified'],
    },
  },
});

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Envia uma mensagem ao LLM e retorna resposta + dados extraídos.
 * Usa dois calls em paralelo:
 *   1. chatModel    → resposta conversacional (texto livre)
 *   2. extractModel → extração estruturada só da mensagem atual
 */
export async function chat(
  history: Message[],
  userMessage: string,
  accumulated: Record<string, string | null> = {}
): Promise<LLMResponse> {
  // Remove mensagens de bot do início (welcome message não passa pelo LLM)
  const trimmed = [...history];
  while (trimmed.length > 0 && trimmed[0].role === 'bot') trimmed.shift();

  const llmHistory: Content[] = trimmed.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  // Cria o modelo de chat com o contexto acumulado para não repetir perguntas
  const chatModelWithContext = createChatModel(accumulated);

  // Executa os dois calls em paralelo para não aumentar latência
  const [chatResult, extractResult] = await Promise.all([
    chatModelWithContext
      .startChat({ history: llmHistory })
      .sendMessage(userMessage),
    extractModel.generateContent(userMessage),
  ]);

  const message = chatResult.response.text().trim();

  let extracted: Partial<LLMResponse['collected']> & { qualified?: boolean } = {};
  try {
    extracted = JSON.parse(extractResult.response.text());
  } catch {
    // Extração falhou — não quebra a conversa
  }

  return {
    message,
    qualified: extracted.qualified ?? false,
    collected: {
      name:        extracted.name        ?? null,
      projectType: extracted.projectType ?? null,
      clientType:  (extracted.clientType as 'pf' | 'pj' | null) ?? null,
      cnpj:        extracted.cnpj        ?? null,
      contact:     extracted.contact     ?? null,
      budget:      extracted.budget      ?? null,
    },
  };
}

/**
 * Extração final — varre TODAS as mensagens do usuário na sessão.
 * Chamado quando o lead qualifica para garantir que dados de mensagens
 * anteriores não se percam.
 */
export async function extractFromHistory(userMessages: string[]): Promise<Partial<LLMResponse['collected']>> {
  if (userMessages.length === 0) return {};
  const combined = userMessages.join('\n---\n');
  try {
    const result = await extractModel.generateContent(
      `Analise TODAS as mensagens abaixo e extraia os dados encontrados em qualquer uma delas:\n\n${combined}`
    );
    return JSON.parse(result.response.text());
  } catch {
    return {};
  }
}

// ── WhatsApp URL ──────────────────────────────────────────────────────────────

/**
 * Gera a URL de WhatsApp pré-preenchida com os dados do lead.
 * @param collected  Dados coletados durante a conversa
 * @param siteName   Nome do site de origem
 * @param waNumber   Número do WhatsApp configurado no site (ex: 5519993472521)
 */
export function buildWhatsAppUrl(
  collected: LLMResponse['collected'],
  siteName: string,
  waNumber: string,
  botName?: string
): string {
  const lines: string[] = [
    `Olá! Acabei de conversar com ${botName ?? siteName}.`,
    '',
  ];

  if (collected.name)        lines.push(`Nome: ${collected.name}`);
  if (collected.projectType) lines.push(`Projeto: ${collected.projectType}`);
  if (collected.clientType)  lines.push(`Tipo: ${collected.clientType === 'pj' ? 'Empresa' : 'Pessoa física'}`);
  if (collected.cnpj)        lines.push(`CNPJ: ${collected.cnpj}`);
  if (collected.contact)     lines.push(`Contato: ${collected.contact}`);
  if (collected.budget)      lines.push(`Orcamento: ${collected.budget}`);

  const text = lines.join('\n');
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}

/**
 * URL de fallback para quando o LLM falha (quota, erro técnico).
 * Usa o número configurado no site.
 */
export function buildFallbackWhatsAppUrl(waNumber: string, siteName: string): string {
  const text = `Olá! Vim pelo site ${siteName} e gostaria de mais informações.`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}
