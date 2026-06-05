/**
 * Chatbot Widget
 * Vanilla TypeScript — compilado para public/widget.js via esbuild
 * Incluir: <script src="https://your-domain.com/widget.js" data-token="..." defer></script>
 */

// ── Configuração ──────────────────────────────────────────────────────────────

const scriptTag = (document.currentScript ?? document.querySelector('script[data-token]')) as HTMLScriptElement;
const API_BASE   = scriptTag?.src?.replace('/widget.js', '') ?? '';
const TOKEN      = scriptTag?.getAttribute('data-token') ?? '';
const SESSION_KEY = 'chatbot_session_id';

// ── Mensagens proativas (hardcoded, sem custo de LLM) ────────────────────────

const PROACTIVE_MESSAGES = [
  'Oi! 👋 Tem algum projeto em mente? Posso te ajudar!',
  'Olá! Pensando em criar um site para sua empresa? 🚀',
  'Oi! Precisa de um orçamento rápido? Nossa equipe responde logo!',
  'Olá! Posso te ajudar a encontrar a solução ideal. 😊',
  'Oi! Que tal conversar sobre o seu próximo projeto?',
];

// Delays variados em ms (15s a 32s) — aparece em momentos diferentes p/ cada visita
const PROACTIVE_DELAYS = [15000, 20000, 24000, 28000, 32000];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const CSS = `
  #chatbot-widget * { box-sizing: border-box; margin: 0; padding: 0; }

  #chatbot-widget {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity .6s ease, transform .6s ease;
  }
  #chatbot-widget.chatbot-ready { opacity: 1; transform: translateY(0); }

  /* ── Bolha proativa ──────────────────────────────────────────────── */
  #chatbot-bubble {
    position: absolute;
    bottom: 70px;
    right: 0;
    background: #fff;
    color: #1a1a1a;
    padding: 12px 40px 12px 14px;
    border-radius: 16px 16px 4px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,.18);
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1.45;
    max-width: 240px;
    white-space: normal;
    cursor: pointer;
    transform: translateY(8px) scale(.94);
    opacity: 0;
    pointer-events: none;
    transition: opacity .3s ease, transform .35s cubic-bezier(.34,1.56,.64,1);
  }
  #chatbot-bubble.chatbot-show {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: all;
  }
  #chatbot-bubble-close {
    position: absolute;
    top: 7px; right: 8px;
    background: none; border: none;
    color: #999; font-size: 16px;
    cursor: pointer; line-height: 1;
    padding: 2px 5px;
    border-radius: 4px;
    transition: color .15s;
  }
  #chatbot-bubble-close:hover { color: #333; }

  /* Pulsação suave na bolha para chamar atenção */
  @keyframes chatbot-bubble-pulse {
    0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,.18); }
    50%       { box-shadow: 0 8px 40px rgba(37,211,102,.35); }
  }
  #chatbot-bubble.chatbot-pulse { animation: chatbot-bubble-pulse 2s ease infinite; }

  /* ── Botão toggle ────────────────────────────────────────────────── */
  #chatbot-btn {
    width: 56px; height: 56px;
    background: #25D366;
    border: none; border-radius: 20px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 10px 24px rgba(37,211,102,.35);
    transition: transform .25s ease, box-shadow .25s ease;
    position: relative;
    outline: none;
  }
  #chatbot-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(37,211,102,.45); }
  #chatbot-btn svg   { width: 28px; height: 28px; fill: #fff; transition: opacity .2s; }

  .chatbot-btn-ping {
    position: absolute; inset: 0;
    border-radius: 20px;
    background: #25D366; opacity: .25;
    animation: chatbot-ping 2.5s cubic-bezier(0,0,.2,1) infinite;
  }
  @keyframes chatbot-ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }

  .chatbot-btn-dot {
    position: absolute; top: -5px; right: -5px;
    width: 14px; height: 14px;
    background: #ef4444;
    border: 2px solid #25D366; border-radius: 50%;
    animation: chatbot-dot-pulse 2s ease infinite;
  }
  @keyframes chatbot-dot-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

  /* Sacudida do botão quando a bolha aparece */
  @keyframes chatbot-shake {
    0%,100%{transform:rotate(0)}
    20%{transform:rotate(-8deg)}
    40%{transform:rotate(8deg)}
    60%{transform:rotate(-5deg)}
    80%{transform:rotate(5deg)}
  }
  #chatbot-btn.chatbot-shake { animation: chatbot-shake .6s ease; }

  /* ── Painel do chat ──────────────────────────────────────────────── */
  #chatbot-panel {
    position: absolute;
    bottom: 70px; right: 0;
    width: 360px; max-height: 540px;
    background: #0d0d0d;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 20px;
    box-shadow: 0 24px 64px rgba(0,0,0,.6);
    display: flex; flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
    transform: scale(.92) translateY(8px);
    opacity: 0; pointer-events: none;
    transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s ease;
  }
  #chatbot-panel.chatbot-open {
    transform: scale(1) translateY(0);
    opacity: 1; pointer-events: all;
  }

  /* ── Header ──────────────────────────────────────────────────────── */
  #chatbot-header {
    background: #161616;
    padding: 14px 16px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    flex-shrink: 0;
  }
  #chatbot-avatar {
    width: 38px; height: 38px;
    background: #25D366; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px; color: #fff;
    flex-shrink: 0; overflow: hidden;
  }
  #chatbot-avatar img { width: 100%; height: 100%; object-fit: cover; }
  #chatbot-header-info { flex: 1; }
  #chatbot-bot-name  { color: #fff; font-weight: 600; font-size: 14px; display: block; }
  #chatbot-status    { color: #25D366; font-size: 11px; display: flex; align-items: center; gap: 4px; }
  #chatbot-status::before {
    content: ''; display: inline-block;
    width: 7px; height: 7px; background: #25D366; border-radius: 50%;
  }
  #chatbot-close {
    background: none; border: none; cursor: pointer;
    color: #666; font-size: 20px; padding: 4px; border-radius: 8px;
    line-height: 1; transition: color .15s;
  }
  #chatbot-close:hover { color: #fff; }

  /* ── Mensagens ───────────────────────────────────────────────────── */
  #chatbot-messages {
    flex: 1; overflow-y: auto;
    min-height: 0;
    padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
    scrollbar-width: thin; scrollbar-color: #2a2a2a transparent;
  }
  #chatbot-messages::-webkit-scrollbar       { width: 4px; }
  #chatbot-messages::-webkit-scrollbar-track { background: transparent; }
  #chatbot-messages::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }

  .chatbot-msg {
    max-width: 78%; padding: 10px 16px;
    border-radius: 14px; line-height: 1.55;
    font-size: 13px; animation: chatbot-fadein .2s ease;
    word-break: break-word; overflow-wrap: anywhere;
  }
  @keyframes chatbot-fadein { from { opacity:0; transform: translateY(6px); } }
  .chatbot-msg-bot  { background: #1e1e1e; color: #e0e0e0; align-self: flex-start; border-bottom-left-radius: 4px; }
  .chatbot-msg-user { background: #25D366; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }

  #chatbot-typing {
    display: none; align-self: flex-start;
    background: #1e1e1e; border-radius: 14px; border-bottom-left-radius: 4px;
    padding: 12px 16px; gap: 5px; align-items: center;
  }
  #chatbot-typing.chatbot-show { display: flex; }
  #chatbot-typing span {
    width: 7px; height: 7px; background: #666; border-radius: 50%;
    animation: chatbot-bounce 1.2s ease infinite;
  }
  #chatbot-typing span:nth-child(2) { animation-delay: .15s; }
  #chatbot-typing span:nth-child(3) { animation-delay: .30s; }
  @keyframes chatbot-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

  /* ── CTA WhatsApp (estado qualificado) ───────────────────────────── */
  #chatbot-wa-btn {
    display: none;
    margin: 0 16px 16px;
    padding: 10px 20px;
    background: #25D366; color: #fff;
    font-weight: 600; font-size: 13px;
    border: none; border-radius: 12px;
    cursor: pointer; text-decoration: none; text-align: center;
    box-shadow: 0 4px 14px rgba(37,211,102,.3);
    transition: transform .2s, box-shadow .2s; flex-shrink: 0;
    width: fit-content; align-self: center;
  }
  #chatbot-wa-btn.chatbot-show { display: block; }
  #chatbot-wa-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(37,211,102,.4); }

  /* ── Input ───────────────────────────────────────────────────────── */
  #chatbot-input-area {
    display: flex; gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid rgba(255,255,255,.06);
    background: #111; flex-shrink: 0;
  }
  #chatbot-input {
    flex: 1; background: #1e1e1e;
    border: 1px solid rgba(255,255,255,.1); border-radius: 12px;
    padding: 10px 14px; color: #fff;
    font-size: 13.5px; font-family: inherit; outline: none;
    transition: border-color .2s;
  }
  #chatbot-input::placeholder { color: #555; }
  #chatbot-input:focus         { border-color: rgba(37,211,102,.5); }
  #chatbot-input:disabled      { opacity: .4; cursor: not-allowed; }

  #chatbot-send {
    width: 40px; height: 40px;
    background: #25D366; border: none; border-radius: 12px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background .2s, transform .15s;
  }
  #chatbot-send:hover    { background: #20c05c; }
  #chatbot-send:active   { transform: scale(.93); }
  #chatbot-send:disabled { background: #2a2a2a; cursor: default; }
  #chatbot-send svg { width: 18px; height: 18px; fill: #fff; }

  /* ── Mobile ──────────────────────────────────────────────────────── */
  @media (max-width: 400px) {
    #chatbot-widget { bottom: 16px; right: 16px; left: 16px; }
    #chatbot-panel  { width: 100%; right: 0; left: 0; }
    #chatbot-bubble { max-width: 100%; }
  }
`;

// ── SVGs ──────────────────────────────────────────────────────────────────────

const SVG_WA = `<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
const SVG_CLOSE = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const SVG_SEND  = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

// ── Estado ────────────────────────────────────────────────────────────────────

let isOpen        = false;
let isLoading     = false;
let sessionId     = sessionStorage.getItem(SESSION_KEY) ?? null;
let botName       = 'Assistente';
let botAvatarUrl: string | null = null;
let bubbleDismissed = false;

// ── DOM helpers ───────────────────────────────────────────────────────────────

function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

function buildUI(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'chatbot-widget';
  root.innerHTML = `
    <!-- Bolha proativa -->
    <div id="chatbot-bubble">
      <button id="chatbot-bubble-close" aria-label="Fechar">×</button>
      <span id="chatbot-bubble-text"></span>
    </div>

    <!-- Painel do chat -->
    <div id="chatbot-panel">
      <div id="chatbot-header">
        <div id="chatbot-avatar">CB</div>
        <div id="chatbot-header-info">
          <span id="chatbot-bot-name">${botName}</span>
          <span id="chatbot-status">Online</span>
        </div>
        <button id="chatbot-close" aria-label="Fechar chat">✕</button>
      </div>
      <div id="chatbot-messages">
        <div id="chatbot-typing"><span></span><span></span><span></span></div>
      </div>
      <a id="chatbot-wa-btn" target="_blank" rel="noopener noreferrer">
        💬 Falar com nossa equipe no WhatsApp
      </a>
      <div id="chatbot-input-area">
        <input id="chatbot-input" type="text" placeholder="Digite sua mensagem..." maxlength="500" autocomplete="off" />
        <button id="chatbot-send" aria-label="Enviar">${SVG_SEND}</button>
      </div>
    </div>

    <!-- Botão flutuante -->
    <button id="chatbot-btn" aria-label="Abrir chat">
      <div class="chatbot-btn-ping"></div>
      ${SVG_WA}
      <div class="chatbot-btn-dot"></div>
    </button>
  `;
  return root;
}

// ── Bolha proativa ────────────────────────────────────────────────────────────

function showBubble() {
  if (isOpen || bubbleDismissed) return;

  const msg = randomItem(PROACTIVE_MESSAGES);
  const textEl = $('chatbot-bubble-text');
  if (textEl) textEl.textContent = msg;

  const bubble = $('chatbot-bubble');
  bubble.classList.add('chatbot-show');

  // Sacude o botão para chamar atenção
  const btn = $('chatbot-btn');
  btn.classList.add('chatbot-shake');
  btn.addEventListener('animationend', () => btn.classList.remove('chatbot-shake'), { once: true });

  // Pulsa a bolha após 1s
  setTimeout(() => bubble.classList.add('chatbot-pulse'), 1000);

  // Auto-dismiss após 12s
  setTimeout(() => hideBubble(), 12000);
}

function hideBubble() {
  const bubble = $('chatbot-bubble');
  if (!bubble) return;
  bubble.classList.remove('chatbot-show', 'chatbot-pulse');
}

// ── Chat helpers ──────────────────────────────────────────────────────────────

function scrollToBottom() {
  const msgs = $('chatbot-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

function setTyping(show: boolean) {
  $('chatbot-typing').classList.toggle('chatbot-show', show);
  scrollToBottom();
}

function addMessage(content: string, role: 'bot' | 'user') {
  const msgs    = $('chatbot-messages');
  const typing  = $('chatbot-typing');
  const div     = document.createElement('div');
  div.className = `chatbot-msg chatbot-msg-${role}`;
  div.textContent = content;
  msgs.insertBefore(div, typing);
  scrollToBottom();
}

function addConfigErrorMessage() {
  const msgs   = $('chatbot-messages');
  const typing = $('chatbot-typing');
  const div    = document.createElement('div');
  div.className = 'chatbot-msg chatbot-msg-bot';
  div.appendChild(document.createTextNode('Chatbot não configurado para este domínio. Saiba mais em: '));
  const link = document.createElement('a');
  link.href    = 'https://github.com/Guilherme-ruy/op-chatbot';
  link.textContent = 'github.com/Guilherme-ruy/op-chatbot';
  link.target  = '_blank';
  link.rel     = 'noopener noreferrer';
  link.style.color          = '#25D366';
  link.style.textDecoration = 'underline';
  div.appendChild(link);
  msgs.insertBefore(div, typing);
  scrollToBottom();
}

function setInputEnabled(enabled: boolean) {
  ($('chatbot-input') as HTMLInputElement).disabled  = !enabled;
  ($('chatbot-send')  as HTMLButtonElement).disabled = !enabled;
}

function updateAvatar() {
  const avatar = $('chatbot-avatar');
  avatar.innerHTML = botAvatarUrl
    ? `<img src="${botAvatarUrl}" alt="${botName}" />`
    : botName.slice(0, 3).toUpperCase();
  ($('chatbot-bot-name') as HTMLElement).textContent = botName;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function startSession() {
  setTyping(true);
  setInputEnabled(false);

  try {
    const res = await fetch(`${API_BASE}/api/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN }),
    });

    if (res.status === 429) {
      // Limite mensal de conversas atingido pelo site
      const data = await res.json().catch(() => ({}));
      setTyping(false);
      addMessage(
        'No momento este serviço atingiu o limite de atendimentos. ' +
        'Por favor, entre em contato diretamente com nossa equipe. 😊',
        'bot'
      );
      if (data.whatsappUrl) showQualified(data.whatsappUrl);
      return;
    }

    if (res.status === 401 || res.status === 403) {
      // Token inválido ou domínio não cadastrado — erro de configuração
      setTyping(false);
      addConfigErrorMessage();
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    sessionId    = data.sessionId;
    botName      = data.botName ?? botName;
    botAvatarUrl = data.botAvatarUrl ?? null;

    sessionStorage.setItem(SESSION_KEY, sessionId as string);
    updateAvatar();
    setTyping(false);
    addMessage(data.welcomeMessage, 'bot');
    setInputEnabled(true);
    ($('chatbot-input') as HTMLInputElement).focus();
  } catch {
    setTyping(false);
    addMessage('Ops! Algo deu errado por aqui. Tente novamente em breve.', 'bot');
  }
}

async function sendMessage(text: string) {
  if (isLoading || !text.trim() || !sessionId) return;

  isLoading = true;
  setInputEnabled(false);
  addMessage(text, 'user');
  setTyping(true);

  try {
    const res = await fetch(`${API_BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: text }),
    });

    // Sessão encerrada ou não encontrada — limpa e reinicia automaticamente
    if (res.status === 400 || res.status === 404) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionId = null;
      clearMessages();
      isLoading = false;
      await startSession();
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    setTyping(false);
    addMessage(data.message, 'bot');

    if (data.qualified && data.whatsappUrl) {
      showQualified(data.whatsappUrl);
    } else {
      setInputEnabled(true);
      ($('chatbot-input') as HTMLInputElement).focus();
    }
  } catch {
    setTyping(false);
    addMessage('Tive um problema técnico. Pode tentar de novo?', 'bot');
    setInputEnabled(true);
  } finally {
    isLoading = false;
  }
}

function clearMessages() {
  const msgs   = $('chatbot-messages');
  const typing = $('chatbot-typing');
  Array.from(msgs.children).forEach(c => { if (c !== typing) c.remove(); });
  $('chatbot-input-area').style.display = '';
  $('chatbot-wa-btn').classList.remove('chatbot-show');
  ($('chatbot-wa-btn') as HTMLAnchorElement).href = '';
}

function showQualified(waUrl: string) {
  setInputEnabled(false);
  $('chatbot-input-area').style.display = 'none';

  const waBtn = $('chatbot-wa-btn') as HTMLAnchorElement;
  waBtn.href = waUrl;
  waBtn.classList.add('chatbot-show');
  scrollToBottom();
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function openPanel() {
  isOpen = true;
  hideBubble();
  $('chatbot-panel').classList.add('chatbot-open');

  // Troca ícone para X — sem remover #chatbot-btn-ping para manter o anel
  const btn = $('chatbot-btn');
  btn.innerHTML = `<div class="chatbot-btn-ping"></div>${SVG_CLOSE}`;
  // Nota: .chatbot-btn-dot é recriado ao fechar — aqui não existe mais, sem problema

  if (!sessionId) {
    startSession();
  } else {
    setInputEnabled(true);
    ($('chatbot-input') as HTMLInputElement)?.focus();
  }
}

function closePanel() {
  isOpen = false;
  $('chatbot-panel').classList.remove('chatbot-open');

  // Restaura botão com ícone WA + dot
  $('chatbot-btn').innerHTML = `<div class="chatbot-btn-ping"></div>${SVG_WA}<div class="chatbot-btn-dot"></div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  if (!TOKEN) {
    console.warn('[Chatbot Widget] data-token não encontrado.');
    return;
  }

  injectStyles();

  const root = buildUI();
  document.body.appendChild(root);

  // Toggle do painel
  $('chatbot-btn').addEventListener('click', () => isOpen ? closePanel() : openPanel());
  $('chatbot-close').addEventListener('click', closePanel);

  // Bolha: clicar abre o painel
  $('chatbot-bubble').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'chatbot-bubble-close') return;
    bubbleDismissed = true;
    hideBubble();
    openPanel();
  });

  // Bolha: fechar sem abrir
  $('chatbot-bubble-close').addEventListener('click', (e) => {
    e.stopPropagation();
    bubbleDismissed = true;
    hideBubble();
  });

  // Enviar mensagem: botão
  $('chatbot-send').addEventListener('click', () => {
    const input = $('chatbot-input') as HTMLInputElement;
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    sendMessage(text);
  });

  // Enviar mensagem: Enter
  $('chatbot-input').addEventListener('keydown', (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' || ke.shiftKey) return;
    ke.preventDefault();
    const input = $('chatbot-input') as HTMLInputElement;
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    sendMessage(text);
  });

  // Aparece suavemente após 2.5s
  setTimeout(() => $('chatbot-widget').classList.add('chatbot-ready'), 2500);

  // Bolha proativa após delay aleatório
  const proactiveDelay = randomItem(PROACTIVE_DELAYS);
  setTimeout(showBubble, proactiveDelay);
}

// Aguarda DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
