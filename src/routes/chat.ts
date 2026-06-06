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
  SiteField,
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
    if (digits[2] === '9') return { valid: false, reason: 'incomplete_mobile' };
    return { valid: true };
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
      if (!site.active) {
        return reply.status(503).send({ error: 'Chatbot temporariamente indisponível.' });
      }

      // 3. Valida Origin contra o domínio registrado
      const origin = request.headers.origin ?? '';
      const originHost = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const domainMatch =
        originHost === site.domain ||
        originHost.endsWith(`.${site.domain}`);

      if (!domainMatch) {
        return reply.status(403).send({ error: 'Origem não autorizada para este token.' });
      }

      // 4. Verifica limite mensal de conversas do site (se configurado)
      if (site.monthly_session_limit !== null && site.monthly_session_limit > 0) {
        const usedThisMonth = await db.countMonthlySessionsForSite(site.id);
        if (usedThisMonth >= site.monthly_session_limit) {
          const waNumber = site.whatsapp_number ?? '';
          const waUrl = site.limit_message
            ? `https://wa.me/${waNumber}?text=${encodeURIComponent(site.limit_message)}`
            : buildFallbackWhatsAppUrl(waNumber, site.name);

          return reply.status(429).send({
            error: 'Limite mensal de conversas atingido.',
            limitReached: true,
            whatsappUrl: waUrl,
          });
        }
      }

      // 5. Cria sessão
      const session = await db.createSession(site.id);

      // 6. Salva mensagem de boas-vindas no histórico (variação aleatória, sem custo de LLM)
      const welcome = ai.randomWelcome();
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

      // 1. Valida sessão e carrega site
      const session = await db.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Sessão não encontrada.' });
      }
      if (session.status !== 'active') {
        return reply.status(400).send({ error: 'Sessão encerrada.' });
      }

      const site = await db.getSiteBySessionId(sessionId);
      const waNumber = site?.whatsapp_number ?? '';
      const siteName = site?.name ?? '';
      const botName  = site?.bot_name ?? siteName;

      // 2. Carrega campos configurados do site
      const siteFields: SiteField[] = site ? await db.getSiteFields(site.id) : [];

      // 3. Verifica limite de mensagens (guardrail de custo)
      const count = await db.incrementMessageCount(sessionId);
      if (count > config.maxMessagesPerSession) {
        await db.updateSessionStatus(sessionId, 'abandoned');
        return reply.send({
          message: 'Parece que nossa conversa está se prolongando. Que tal falar diretamente com nossa equipe? 😊',
          qualified: true,
          whatsappUrl: buildFallbackWhatsAppUrl(waNumber, siteName),
        } satisfies ChatMessageResponse);
      }

      // 4. Salva mensagem do usuário
      await db.saveMessage(sessionId, 'user', message);

      // 5. Busca histórico + contexto acumulado e chama o LLM
      const [history, currentAccumulated] = await Promise.all([
        db.getMessageHistory(sessionId),
        db.getCollectedData(sessionId),
      ]);

      let aiResult: Awaited<ReturnType<typeof ai.chat>>;
      try {
        aiResult = await ai.chat(history.slice(0, -1), message, currentAccumulated, siteFields);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);

        if (errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('overloaded')) {
          app.log.warn({ err }, 'LLM 503 — instabilidade temporária');
          return reply.send({
            message: 'Tive um pequeno problema técnico. Pode repetir a mensagem? 🙏',
            qualified: false,
          } satisfies ChatMessageResponse);
        }

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

      // 6. Valida contato ANTES de salvar/qualificar (somente se campo 'contact' existe)
      const hasContactField = siteFields.some(f => f.key === 'contact');
      let contactInvalidReason: string | null = null;
      if (hasContactField && aiResult.collected['contact']) {
        const cv = validateBrazilianContact(aiResult.collected['contact']);
        if (!cv.valid) {
          contactInvalidReason = cv.reason;
          const validationMsg = contactValidationMessage(aiResult.collected['contact'], cv.reason);
          aiResult = {
            ...aiResult,
            message: validationMsg,
            qualified: false,
            collected: { ...aiResult.collected, contact: null },
          };
        }
      }

      // 7. Salva resposta do bot e acumula dados
      await db.saveMessage(sessionId, 'bot', aiResult.message);
      await db.mergeCollectedData(sessionId, aiResult.collected);

      if (contactInvalidReason) {
        app.log.info({ contact: aiResult.collected['contact'], reason: contactInvalidReason }, 'Contato inválido — aguardando correção');
      }

      // 8. Verifica qualificação pelo acumulador (fonte de verdade)
      let accumulated = await db.getCollectedData(sessionId);
      const isQualified = aiResult.qualified || ai.isLeadQualified(accumulated, siteFields);

      // Se qualificou mas a resposta não soa como encerramento, sobrescreve
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
        // Extração final: garante que dados de mensagens anteriores não se percam
        const hasMissing = siteFields
          .filter(f => f.required)
          .some(f => !accumulated[f.key]);

        if (hasMissing) {
          const allMsgs = await db.getMessageHistory(sessionId);
          const userTexts = allMsgs.filter(m => m.role === 'user').map(m => m.content);
          const finalExtract = await ai.extractFromHistory(userTexts, siteFields);
          await db.mergeCollectedData(sessionId, finalExtract);
          accumulated = await db.getCollectedData(sessionId);
        }

        whatsappUrl = ai.buildWhatsAppUrl(accumulated, siteFields, waNumber, botName);

        const leadId = await db.saveLead(sessionId, accumulated, siteName, whatsappUrl);
        await db.updateSessionStatus(sessionId, 'qualified');

        // Notificação por e-mail (não bloqueia a resposta)
        sendLeadNotification(accumulated, siteFields, siteName, whatsappUrl)
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
