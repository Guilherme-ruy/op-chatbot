/**
 * Camada de abstração do modelo de linguagem (LLM).
 * Atualmente usa Google Gemini via @google/generative-ai.
 * Para trocar de provedor, altere apenas este arquivo e as variáveis de ambiente:
 *   LLM_API_KEY  — chave de API do provedor
 *   LLM_MODEL    — identificador do modelo (padrão: gemini-2.0-flash-lite)
 *
 * Os prompts são gerados dinamicamente a partir dos campos configurados por site
 * (SiteField[]) — sem strings hardcoded de tipo de serviço ou campos fixos.
 */
import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
} from '@google/generative-ai';
import { config } from '../config';
import type { LLMResponse, Message, SiteField } from '../types';

const client = new GoogleGenerativeAI(config.llmApiKey);

// ── Qualificação ──────────────────────────────────────────────────────────────

/**
 * Verifica se todos os campos obrigatórios do site foram preenchidos no acumulador.
 */
export function isLeadQualified(
  accumulated: Record<string, string | null>,
  fields: SiteField[]
): boolean {
  return fields
    .filter(f => f.required)
    .every(f => {
      const v = accumulated[f.key];
      return v !== null && v !== undefined && v.toString().trim() !== '';
    });
}

// ── Construtores de prompts dinâmicos ─────────────────────────────────────────

function buildChatSystemPrompt(
  fields: SiteField[],
  accumulated: Record<string, string | null> = {}
): string {
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  const fieldsList = sorted.map((f, i) => {
    const parts = [`${i + 1}. ${f.label}${f.required ? '' : ' (opcional)'}`];
    if (f.hint) parts.push(`   → ${f.hint}`);
    return parts.join('\n');
  }).join('\n');

  const collectedLines = Object.entries(accumulated)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const field = fields.find(f => f.key === k);
      return `  ${field?.label ?? k}: ${v}`;
    })
    .join('\n');

  const alreadyCollected = collectedLines
    ? `\n\nDADOS JÁ COLETADOS (NÃO PERGUNTE NOVAMENTE):\n${collectedLines}`
    : '';

  const hasContactField = sorted.some(f => f.key === 'contact');
  const phoneValidation = hasContactField ? `
VALIDAÇÃO DE CONTATO BRASILEIRO:
- Celular com DDD: 11 dígitos (ex: 11987654321) ✓
- Fixo com DDD: 10 dígitos (ex: 1134567890) ✓
- Número sem DDD → peça o DDD: "Pode me informar o DDD também?"
- 10 dígitos onde o 3º dígito é 9 → provavelmente faltando 1 dígito → confirme
- E-mail: aceite normalmente` : '';

  const requiredFields = sorted.filter(f => f.required).map(f => f.label);
  const qualifyWhen = requiredFields.length > 0
    ? `Assim que tiver: ${requiredFields.join(', ')} — agradeça em 1 frase e diga que a equipe entrará em contato em breve.`
    : 'Assim que completar a coleta de dados — agradeça e diga que a equipe entrará em contato.';

  return `Você é um assistente virtual de qualificação de leads.
MISSÃO: Qualificar leads de forma rápida, amigável e conversacional em português brasileiro.

DADOS A COLETAR (um por vez, na ordem abaixo):
${fieldsList}

REGRAS IMPORTANTES:
- Faça UMA pergunta por vez — nunca combine perguntas na mesma mensagem
- NÃO repita perguntas para dados que já foram fornecidos
- Respostas CURTAS: máximo 1 frase de resposta + 1 pergunta. Seja direto.
- APENAS sobre os serviços da empresa — se fugir do assunto, redirecione em 1 frase
- NÃO cite preços; NÃO responda perguntas técnicas profundas
${phoneValidation}

QUANDO ENCERRAR:
- ${qualifyWhen}
- NÃO peça mais nada após isso.${alreadyCollected}`.trim();
}

function buildExtractSystemPrompt(fields: SiteField[]): string {
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  const fieldDescriptions = sorted.map(f => {
    // Inclui as primeiras 120 chars do hint como contexto para o extrator
    const hintSuffix = f.hint ? ` (${f.hint.slice(0, 120)})` : '';
    return `- ${f.key}: extraia "${f.label.toLowerCase()}"${hintSuffix}`;
  }).join('\n');

  return `Você é um extrator de dados. Leia a mensagem e extraia SOMENTE o que está EXPLICITAMENTE escrito.
NUNCA invente, suponha ou infira valores. Se não tiver certeza absoluta, retorne null.

Campos a extrair (chave: o que extrair):
${fieldDescriptions}
- qualified: true APENAS se esta mensagem sozinha contiver todos os campos obrigatórios

Atenção:
- Um número de telefone (8-11 dígitos) é o campo "contact", NUNCA outro campo
- Se em dúvida sobre qualquer campo, retorne null`.trim();
}

function buildExtractSchema(fields: SiteField[]) {
  const properties: Record<string, { type: SchemaType; nullable: boolean }> = {
    qualified: { type: SchemaType.BOOLEAN, nullable: false },
  };
  for (const field of fields) {
    properties[field.key] = { type: SchemaType.STRING, nullable: true };
  }
  return {
    type: SchemaType.OBJECT,
    properties,
    required: ['qualified'],
  };
}

// ── Model factories ───────────────────────────────────────────────────────────

function createChatModel(fields: SiteField[], accumulated: Record<string, string | null>) {
  return client.getGenerativeModel({
    model: config.llmModel,
    systemInstruction: buildChatSystemPrompt(fields, accumulated),
    generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
  });
}

function createExtractModel(fields: SiteField[]) {
  return client.getGenerativeModel({
    model: config.llmModel,
    systemInstruction: buildExtractSystemPrompt(fields),
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      responseSchema: buildExtractSchema(fields),
    },
  });
}

// ── Variações da mensagem de boas-vindas ──────────────────────────────────────

const WELCOME_MESSAGES = [
  'Olá! 👋 Estou aqui para te ajudar. Pode começar me dizendo seu nome? 😊',
  'Oi! Para te conectar com a equipe certa, pode me dizer seu nome?',
  'Olá! 😊 Estou aqui para ajudar. Como posso te chamar?',
  'Oi, tudo bem? Para te direcionar melhor, pode me contar seu nome?',
  'Bem-vindo! 🚀 Vou te ajudar a encontrar a solução perfeita. Me diz seu nome!',
];

export function randomWelcome(): string {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Envia uma mensagem ao LLM e retorna resposta + dados extraídos.
 * Usa dois calls em paralelo:
 *   1. chatModel    → resposta conversacional (texto livre)
 *   2. extractModel → extração estruturada só da mensagem atual
 *
 * Os campos coletados têm chaves que correspondem exatamente a SiteField.key.
 */
export async function chat(
  history: Message[],
  userMessage: string,
  accumulated: Record<string, string | null> = {},
  fields: SiteField[] = []
): Promise<LLMResponse> {
  // Remove mensagens de bot do início (welcome message não passa pelo LLM)
  const trimmed = [...history];
  while (trimmed.length > 0 && trimmed[0].role === 'bot') trimmed.shift();

  const llmHistory: Content[] = trimmed.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const chatModel    = createChatModel(fields, accumulated);
  const extractModel = createExtractModel(fields);

  // Executa os dois calls em paralelo para não aumentar latência
  const [chatResult, extractResult] = await Promise.all([
    chatModel.startChat({ history: llmHistory }).sendMessage(userMessage),
    extractModel.generateContent(userMessage),
  ]);

  const message = chatResult.response.text().trim();

  let extracted: Record<string, unknown> = {};
  try {
    extracted = JSON.parse(extractResult.response.text());
  } catch {
    // Extração falhou — não quebra a conversa
  }

  // Mapeia os campos extraídos para Record<key, string|null>
  const collected: Record<string, string | null> = {};
  for (const field of fields) {
    const v = extracted[field.key];
    collected[field.key] = (typeof v === 'string' && v.trim()) ? v.trim() : null;
  }

  return {
    message,
    qualified: typeof extracted['qualified'] === 'boolean' ? extracted['qualified'] : false,
    collected,
  };
}

/**
 * Extração final — varre TODAS as mensagens do usuário na sessão.
 * Chamado quando o lead qualifica para garantir que dados de mensagens
 * anteriores não se percam.
 */
export async function extractFromHistory(
  userMessages: string[],
  fields: SiteField[] = []
): Promise<Record<string, string | null>> {
  if (userMessages.length === 0) return {};
  const extractModel = createExtractModel(fields);
  const combined = userMessages.join('\n---\n');
  try {
    const result = await extractModel.generateContent(
      `Analise TODAS as mensagens abaixo e extraia os dados encontrados em qualquer uma delas:\n\n${combined}`
    );
    const parsed = JSON.parse(result.response.text()) as Record<string, unknown>;
    const out: Record<string, string | null> = {};
    for (const field of fields) {
      const v = parsed[field.key];
      out[field.key] = (typeof v === 'string' && v.trim()) ? v.trim() : null;
    }
    return out;
  } catch {
    return {};
  }
}

// ── WhatsApp URL ──────────────────────────────────────────────────────────────

/**
 * Gera a URL de WhatsApp pré-preenchida com os dados do lead.
 * Usa os campos configurados para montar as linhas da mensagem na ordem correta.
 */
export function buildWhatsAppUrl(
  customData: Record<string, string | null>,
  fields: SiteField[],
  waNumber: string,
  botName: string
): string {
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const lines: string[] = [`Olá! Acabei de conversar com ${botName}.`, ''];

  for (const field of sorted) {
    const value = customData[field.key];
    if (value) lines.push(`${field.label}: ${value}`);
  }

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/**
 * URL de fallback para quando o LLM falha (quota, erro técnico).
 * Usa o número configurado no site.
 */
export function buildFallbackWhatsAppUrl(waNumber: string, siteName: string): string {
  const text = `Olá! Vim pelo site ${siteName} e gostaria de mais informações.`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}
