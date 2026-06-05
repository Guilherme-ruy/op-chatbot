# Painel Admin

Interface web para gerenciar sites, acompanhar leads, visualizar conversas e monitorar métricas. Construída com React 18 + shadcn/ui + Tailwind CSS.

**URL (produção):** `https://your-domain.com/admin`  
**URL (desenvolvimento):** `http://localhost:5173/admin/`  
**Login:** e-mail e senha configurados no `db:admin-migrate`  
**Sessão:** JWT com duração de 8 horas

---

## Navegação

```
Sidebar
├── Sites       → gerenciar sites e tokens
├── Leads       → leads qualificados com filtros
├── Sessões     → histórico de conversas
└── Dashboard   → métricas com seletor de site e período
```

---

## Sites

Lista todos os sites ativos com estatísticas acumuladas (sessões totais, leads totais).

**Ações por site:**
- **Ver detalhes** → Visão por site (gráficos, uso mensal, últimos leads)
- **Editar** → atualiza nome, domínio, bot, WhatsApp, limite e mensagem de limite
- **Ativar/Desativar** → controla se o widget aceita novas sessões
- **Regenerar token** → invalida o token atual e gera um novo (exige digitar **SIM**)
- **Excluir** → soft delete (dados preservados, site pode ser restaurado)

**Seção "Sites excluídos"** (colapsável na mesma página) → permite restaurar um site deletado.

### Criar / editar site

Campos obrigatórios:
- **Nome do site**
- **Domínio** (ex: `clinicasilva.com.br`) — usado para validação de segurança: o widget só funciona a partir deste domínio exato (ou subdomínios). Para testes locais, use `localhost:3001`.
- **Nome do bot**
- **WhatsApp** (formato: `5511999990000` — país + DDD + número, apenas dígitos)

Campos opcionais:
- URL do avatar do bot
- Limite mensal de conversas (`0` ou vazio = ilimitado)
- **Mensagem ao atingir o limite** — texto exibido na bolha do widget quando o limite mensal é atingido. Máx. 500 caracteres.

O token é gerado automaticamente ao criar. Ao criar ou regenerar, o painel exibe o snippet `<script>` completo pronto para colar no site.

### Regenerar token

Ao clicar em "Regenerar token":
1. Exige digitar **SIM** para confirmar (o token antigo para de funcionar imediatamente)
2. Exibe o novo snippet `<script>` com o token atualizado para copiar

### Confirmação de ações críticas

Excluir, Restaurar e Regenerar token exigem digitar **SIM** antes de prosseguir.

---

## Leads

Lista paginada de todos os leads qualificados.

**Filtros disponíveis:**
- Busca por nome ou contato
- Site de origem
- Tipo de projeto (site / sistema / hospedagem / outro)
- Período (data de / até)

**Colunas:** nome, contato, tipo de projeto, PF/PJ, orçamento, site, status de notificação por e-mail, data.

**Ícone de e-mail:**
- ✅ Verde → e-mail de notificação enviado
- ⚠️ Laranja → notificação não enviada (falha no SMTP)

**Botão WhatsApp:** abre conversa direta com o link pré-preenchido dos dados do lead.

**Exportar CSV:** baixa todos os leads com os filtros ativos (sem paginação). Compatível com Excel (BOM UTF-8).

---

## Sessões

Histórico de todas as conversas (ativas, qualificadas e abandonadas).

**Filtros:** site, status, período.

**Replay de conversa:** clique no ícone de mensagem para abrir o painel lateral com:
- Status e dados coletados da sessão
- Histórico completo de mensagens com timestamps
- Bubbles visuais (visitante = verde, bot = cinza)

---

## Dashboard

Visão de métricas com **seletor de site** e **filtro de período** no topo.

### Seletor de site

- **Todos os sites** — dados agregados de toda a plataforma
- **Site individual** — dados específicos daquele site (idêntico à Visão por site)

### Filtro de período

| Opção | Intervalo |
|---|---|
| 7 dias | Últimos 7 dias |
| 30 dias | Últimos 30 dias (padrão) |
| 90 dias | Últimos 90 dias |
| Todo período | Histórico completo |

O filtro afeta KPIs, gráficos de atividade, tipos de projeto e horários de pico.  
**Não** afeta: "Uso mensal" (sempre mês corrente) e "Totais históricos" (sempre acumulado).

### Bloco "Uso mensal"

Exibido apenas na visão de site individual (não faz sentido para "todos os sites").

Mostra conversas usadas vs. limite do mês atual com barra de progresso.  
Ao atingir 100%, o widget do site é substituído automaticamente por um botão de WhatsApp.

### KPIs do período

| Métrica | O que significa |
|---|---|
| Leads no período | Leads qualificados no intervalo selecionado |
| Média msgs/conversa | Engajamento médio do visitante |
| Saíram sem finalizar | % de sessões que encerraram sem qualificar |

### Gráficos

- **Atividade:** sessões e leads por dia (ou por mês, no modo "todo período")
- **Tipos de projeto:** distribuição dos leads por categoria
- **Horários de pico:** distribuição por hora do dia

### Últimos leads

Os 5 leads mais recentes. Na visão "todos os sites", exibe também o nome do site de origem.

---

## Visão por site

Acesse via **"Ver detalhes"** no menu de ações de qualquer site, ou selecione o site no Dashboard.

Idêntica ao Dashboard com site individual selecionado. Inclui adicionalmente o **Código de instalação** — snippet `<script>` pronto para copiar e colar no site do cliente.

---

## Segurança

- JWT expira em 8 horas — ao expirar, o painel redireciona para o login automaticamente
- Após logout, o token é removido do `localStorage`
- Erros 401 da API limpam o token e redirecionam para o login
- Ações críticas (excluir, restaurar, regenerar token) exigem confirmação digitada
