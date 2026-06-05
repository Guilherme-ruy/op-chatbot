# Painel Admin

Interface web para gerenciar clientes, acompanhar leads, visualizar conversas e monitorar métricas. Construída com React 18 + shadcn/ui + Tailwind CSS.

**URL (produção):** `https://your-domain.com/admin`  
**URL (desenvolvimento):** `http://localhost:5173/admin/`  
**Login:** e-mail e senha configurados no `db:admin-migrate`  
**Sessão:** JWT com duração de 8 horas

---

## Navegação

```
Sidebar
├── Clientes      → gerenciar sites/clientes
├── Leads         → leads qualificados com filtros
├── Sessões       → histórico de conversas
└── Dashboard     → KPIs e gráficos (últimos 30 dias)
```

Clicando em um cliente na tabela de Clientes → abre a **Visão por site** com estatísticas detalhadas.

---

## Clientes

Lista todos os sites ativos com estatísticas acumuladas (sessões totais, leads totais).

**Ações por cliente:**
- **Ver detalhes** → Visão por site (gráficos, uso mensal, últimos leads)
- **Editar** → atualiza nome, domínio, bot, WhatsApp, plano e limite
- **Ativar/Desativar** → controla se o widget aceita novas sessões
- **Regenerar token** → invalida o token atual e gera um novo
- **Excluir** → soft delete (dados preservados, cliente pode ser restaurado)

**Seção "Clientes excluídos"** (colapsável na mesma página) → permite restaurar um cliente deletado.

### Criar novo cliente

Campos obrigatórios:
- Nome do cliente
- Domínio (ex: `clinicasilva.com.br`)
- Nome do bot
- Número do WhatsApp (formato: `5511999990000`)

Campos opcionais:
- URL do avatar do bot
- Nome do plano (ex: Básico, Pro)
- Limite mensal de conversas (`0` / vazio = ilimitado)

O token é gerado automaticamente.

### Confirmação de ações críticas

Excluir e Restaurar exigem digitar **SIM** no campo de confirmação antes de prosseguir. Protege contra cliques acidentais.

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

Visão geral de todos os clientes nos últimos 30 dias.

**KPIs:**
- Sites ativos
- Total de sessões
- Total de leads
- Taxa de qualificação (%)

**Gráficos:**
- Leads por dia (barras — últimos 30 dias)
- Distribuição por tipo de projeto (rosca)
- Top 5 sites por volume de leads (tabela)

---

## Visão por site

Acesse via **"Ver detalhes"** no menu de ações de qualquer cliente.

### Bloco de uso mensal

Mostra conversas usadas vs. limite do mês atual:
- Barra de progresso com cor adaptável
  - 🟢 Verde: < 75%
  - 🟡 Laranja: 75–89%
  - 🔴 Vermelho: ≥ 90%
- Data de renovação (dia 1 do próximo mês)
- Nome do plano (se configurado)

### KPIs do período

| Métrica | O que significa |
|---|---|
| Leads este mês | Leads qualificados no mês atual |
| Taxa de qualificação | % de sessões que geraram lead |
| Média de msgs/conversa | Mede o engajamento do visitante |
| Taxa de abandono | % de sessões que terminaram sem qualificar |

### Gráficos

- **Atividade (30 dias):** sessões e leads sobrepostos por dia
- **Tipos de projeto:** distribuição dos leads por categoria, com barras de proporção
- **Horários de pico:** distribuição por hora do dia (últimas 4 semanas)

### Últimos leads

Os 5 leads mais recentes com botão de WhatsApp direto.

### Código de instalação

Snippet `<script>` pronto para copiar e entregar ao cliente. Botão de copiar integrado.

---

## Segurança

- JWT expira em 8 horas — ao expirar, o painel redireciona para o login automaticamente
- Após logout, o token é removido do `localStorage`
- Erros 401 da API limpam o token e redirecionam para o login
- Ações críticas (excluir, restaurar) exigem confirmação digitada
