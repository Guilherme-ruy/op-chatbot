import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import * as db    from '../services/database';
import * as ai    from '../services/llm';
import { buildFallbackWhatsAppUrl } from '../services/llm';
import { sendLeadNotification } from '../services/email';
import type {
  StartSessionBody,
  SendMessageBody,
  ChatStartResponse,
  ChatMessageResponse,
} from '../types';

// ── Validação de telefone brasileiro ─────────────────────────────────────────

type ContactValidity =
  | { valid: true }
  | { valid: false; reason: 'incomplete_mobile' | 'no_ddd' | 'too_short' | 'too_long' };

function validateBrazilianContact(contact: string): ContactValidity {
  // E-mail — aceita sem validação adicional de formato
  if (contact.includes('@')) return { valid: true };

  const digits = contact.replace(/\D/g, '');

  // 11 dígitos: celular com DDD (DDD 2 + 9 + 8 dígitos) ✓
  if (digits.length === 11) return { valid: true };

  // 10 dígitos: fixo com DDD (válido) ou celular com DDD incompleto
  if (digits.length === 10) {
    // 3º dígito é 9 → provavelmente celular faltando 1 dígito
    if (digits[2] === '9') return { valid: false, reason: 'incomplete_mobile' };
    return { valid: true }; // fixo com DDD ✓
  }

  // 9 dígitos começando com 9 → celular sem DDD
  if (digits.length === 9 && digits[0] === '9') return { valid: false, reason: 'no_ddd' };

  // 8 dígitos → fixo sem DDD
  if (digits.length === 8) return { valid: false, reason: 'no_ddd' };

  return { valid: false, reason: digits.length < 8 ? 'too_short' : 'too_long' };
}

function contactValidationMessage(contact: string, reason: string): string {
  const digits = contact.replace(/\D/g, '');
  if (reason === 'incomplete_mobile') {
    const ddd = digits.slice(0, 2);
    return `Só para não errar: parece que falta um dígito no seu celular (DDD ${ddd}). Pode me confirmar o número completo? 😊`;
  }
  if (reason === 'no_ddd') {
    return `Pode me informar o DDD junto com o número? (ex: 11 9${digits.slice(digits[0] === '9' ? 1 : 0)}) 😊`;
  }
  return `Pode confirmar seu número de contato com DDD? 😊`;
}

// ── Variações da mensagem de boas-vindas — hardcoded, sem custo de API ────────
const WELCOME_MESSAGES = [
  'Olá! 👋 Estou aqui para te ajudar. Pode começar me dizendo seu nome? 😊',
  'Oi! Para te conectar com a equipe certa, pode me dizer seu nome?',
  'Olá! 😊 Estou aqui para ajudar. Como posso te chamar?',
  'Oi, tudo bem? Para te direcionar melhor, pode me contar seu nome?',
  'Bem-vindo! 🚀 Vou te ajudar a encontrar a solução perfeita. Me diz seu nome!',
];

function randomWelcome(): string {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}

export async function chatRoutes(app: FastifyInstance) {

  // ── POST /api/chat/start ────────────────────────────────────────────────────
  app.post<{ Body: StartSessionBody }>(
    '/api/chat/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.body;

      // 1. Valida token
      const site = await db.getSiteByToken(token);
      if (!site) {
        return reply.status(401).send({ error: 'Token inválido.' });
      }

      // 2. Verifica se o site está ativo
      // (separado do lookup para distinguir "token inexistente" de "site desativado")
      if (!site.active) {
        return reply.status(503).send({ error: 'Chatbot temporariamente indisponível.' });
      }

      // 3. Valida Origin contra o domínio registrado para este token
      // O request deve vir exatamente do domínio cadastrado no painel admin
      // para este token. Subdomínios também são aceitos (ex: www.meusite.com.br).
      // Para testes locais, cadastre localhost ou localhost:3001 como domínio no admin.
      const origin = request.headers.origin ?? '';
      const originHost = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const domainMatch =
        originHost === site.domain ||
        originHost.endsWith(`.${site.domain}`);

      if (!domainMatch) {
        return reply.status(403).send({ error: 'Origem não autorizada para este token.' });
      }

      // 4. Verifica limite mensal de conversas do site (se configurado)
      // monthly_session_limit null ou 0 = ilimitado
      if (site.monthly_session_limit !== null && site.monthly_session_limit > 0) {
        const usedThisMonth = await db.countMonthlySessionsForSite(site.id);
        if (usedThisMonth >= site.monthly_session_limit) {
          return reply.status(429).send({
            error: 'Limite mensal de conversas atingido.',
            limitReached: true,
            whatsappUrl: buildFallbackWhatsAppUrl(site.whatsapp_number ?? '', site.name),
            limitMessage: site.limit_message ?? null,
          });
        }
      }

      // 5. Cria sessão
      const session = await db.createSession(site.id);

      // 6. Salva mensagem de boas-vindas no histórico (variação aleatória, sem custo de LLM)
      const welcome = randomWelcome();
      await db.saveMessage(session.id, 'bot', welcome);

      const response: ChatStartResponse = {
        sessionId:    session.id,
        botName:      site.bot_name,
        botAvatarUrl: site.bot_avatar_url,
        welcomeMessage: welcome,
      };

      return reply.send(response);
    }
  );

  // ── POST /api/chat/message ──────────────────────────────────────────────────
  app.post<{ Body: SendMessageBody }>(
    '/api/chat/message',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sessionId', 'message'],
          properties: {
            sessionId: { type: 'string' },
            message:   { type: 'string', minLength: 1, maxLength: 1000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId, message } = request.body;

      // 1. Valida sessão e carrega site (necessário para whatsapp_number)
      const session = await db.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Sessão não encontrada.' });
      }
      if (session.status !== 'active') {
        return reply.status(400).send({ error: 'Sessão encerrada.' });
      }

      const site = await db.getSiteBySessionId(sessionId);
      const waNumber  = site?.whatsapp_number ?? '';
      const siteName  = site?.name ?? 'Assistente';

      // 2. Verifica limite de mensagens (guardrail de custo)
      const count = await db.incrementMessageCount(sessionId);
      if (count > config.maxMessagesPerSession) {
        await db.updateSessionStatus(sessionId, 'abandoned');
        return reply.send({
          message: 'Parece que nossa conversa está se prolongando. Que tal falar diretamente com nossa equipe? 😊',
          qualified: true,
          whatsappUrl: buildFallbackWhatsAppUrl(waNumber, siteName),
        } satisfies ChatMessageResponse);
      }

      // 3. Salva mensagem do usuário
      await db.saveMessage(sessionId, 'user', message);

      // 4. Busca histórico + contexto acumulado e chama o LLM
      const [history, currentAccumulated] = await Promise.all([
        db.getMessageHistory(sessionId),
        db.getCollectedData(sessionId),
      ]);
      let aiResult: Awaited<ReturnType<typeof ai.chat>>;
      try {
        aiResult = await ai.chat(history.slice(0, -1), message, currentAccumulated);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // 503 — modelo sobrecarregado momentaneamente: pede para tentar de novo
        if (errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('overloaded')) {
          app.log.warn({ err }, 'LLM 503 — instabilidade temporária');
          return reply.send({
            message: 'Tive um pequeno problema técnico. Pode repetir a mensagem? 🙏',
            qualified: false,
          } satisfies ChatMessageResponse);
        }

        // 429 — cota esgotada: redireciona para WhatsApp
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          app.log.warn({ err }, 'LLM 429 — cota esgotada, fallback WhatsApp');
          return reply.send({
            message: 'Estou com dificuldades técnicas no momento. Clique abaixo para falar diretamente com nossa equipe! 😊',
            qualified: true,
            whatsappUrl: buildFallbackWhatsAppUrl(waNumber, siteName),
          } satisfies ChatMessageResponse);
        }

        throw err;
      }

      // 5. Valida contato extraído ANTES de salvar/qualificar
      //    Se inválido, anula o campo e sobrescreve a mensagem do bot
      let contactInvalidReason: string | null = null;
      if (aiResult.collected.contact) {
        const cv = validateBrazilianContact(aiResult.collected.contact);
        if (!cv.valid) {
          contactInvalidReason = cv.reason;
          const validationMsg = contactValidationMessage(aiResult.collected.contact, cv.reason);
          aiResult = {
            ...aiResult,
            message: validationMsg,
            qualified: false,
            collected: { ...aiResult.collected, contact: null },
          };
        }
      }

      // 6. Salva resposta do bot (já possivelmente sobrescrita pela validação)
      await db.saveMessage(sessionId, 'bot', aiResult.message);

      // 7. Acumula os dados extraídos da mensagem atual no banco
      //    (contact já é null se era inválido)
      await db.mergeCollectedData(sessionId, aiResult.collected as unknown as Record<string, string | null>);

      if (contactInvalidReason) app.log.info({ contact: aiResult.collected.contact, reason: contactInvalidReason }, 'Contato inválido — aguardando correção');

      // 8. Verifica qualificação pelo acumulador — fonte de verdade mais confiável
      let accumulated = await db.getCollectedData(sessionId);
      const isQualified = aiResult.qualified ||
        !!(accumulated.name && accumulated.projectType && accumulated.contact);

      // Se qualificou mas o bot disse "informe seu contato" ou similar (mismatch
      // entre chatModel e extrator), substituímos pela mensagem de encerramento
      if (isQualified) {
        const closingKeywords = ['equipe entrará', 'entraremos em contato', 'breve', 'obrigado', 'agradeço'];
        const soundsLikeClosing = closingKeywords.some(k => aiResult.message.toLowerCase().includes(k));
        if (!soundsLikeClosing) {
          const closings = [
            `Perfeito! Recebemos tudo que precisamos. Nossa equipe entrará em contato em breve. 😊`,
            `Ótimo! Suas informações foram registradas. Nossa equipe vai te contatar logo!`,
            `Tudo certo! Em breve nosso time entrará em contato para dar continuidade ao projeto.`,
          ];
          aiResult = { ...aiResult, message: closings[Math.floor(Math.random() * closings.length)] };
        }
      }

      app.log.info({ extracted: aiResult.collected, accumulated, isQualified }, 'Lead state');

      let whatsappUrl: string | undefined;

      if (isQualified) {
        // Extração final: se algum campo crítico ainda estiver vazio, varre todo
        // o histórico de mensagens do usuário (garante que dados de mensagens
        // anteriores — ex: nome dito antes de um 503 — não se percam)
        const hasMissing = !accumulated.name || !accumulated.projectType || !accumulated.contact;
        if (hasMissing) {
          const allMsgs = await db.getMessageHistory(sessionId);
          const userTexts = allMsgs.filter(m => m.role === 'user').map(m => m.content);
          const finalExtract = await ai.extractFromHistory(userTexts);
          await db.mergeCollectedData(sessionId, finalExtract as Record<string, string | null>);
          accumulated = await db.getCollectedData(sessionId);
        }

        const fullCollected = {
          name:        accumulated.name        ?? null,
          projectType: accumulated.projectType ?? null,
          clientType:  (accumulated.clientType ?? null) as 'pf' | 'pj' | null,
          cnpj:        accumulated.cnpj        ?? null,
          contact:     accumulated.contact     ?? null,
          budget:      accumulated.budget      ?? null,
        };

        whatsappUrl = ai.buildWhatsAppUrl(fullCollected, siteName, waNumber);

        const leadId = await db.saveLead(sessionId, fullCollected, siteName, whatsappUrl);
        await db.updateSessionStatus(sessionId, 'qualified');

        // Notificação por e-mail — não bloqueia a resposta; marca notified_at ao confirmar envio
        sendLeadNotification(fullCollected, siteName, whatsappUrl)
          .then(() => db.markLeadNotified(leadId))
          .catch(err => app.log.error({ err }, 'Erro ao enviar e-mail de notificação'));
      }

      const response: ChatMessageResponse = {
        message:     aiResult.message,
        qualified:   isQualified,
        whatsappUrl,
      };

      return reply.send(response);
    }
  );
}
