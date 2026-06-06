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
├── Sites          → gerenciar sites e tokens
├── Leads          → leads qualificados com filtros
├── Sessões        → histórico de conversas
├── Dashboard      → métricas com seletor de site e período
├── Configurações  → campos de coleta configuráveis por site
└── E-mail         → configuração SMTP para envio de notificações
```

---

## Sites

Lista todos os sites com estatísticas acumuladas (sessões totais, leads totais).

**Filtro de status** (select no topo da tabela): `Ativos e Inativos` (padrão) · `Ativos` · `Inativos` · `Excluídos`. Selecionar "Excluídos" exibe os sites removidos com opção de restaurar.

**Ações por site:**
- **Ver detalhes** → Visão por site (gráficos, uso mensal, últimos leads)
- **Editar** → atualiza nome, domínio, bot, WhatsApp, limite e mensagem de limite
- **Ativar/Desativar** → controla se o widget aceita novas sessões
- **Regenerar token** → invalida o token atual e gera um novo (exige digitar **SIM**)
- **Excluir** → soft delete (dados preservados, site pode ser restaurado)

### Criar / editar site

Campos obrigatórios:
- **Nome do site**
- **Domínio** (ex: `clinicasilva.com.br`) — usado para validação de segurança: o widget só funciona a partir deste domínio exato (ou subdomínios). Para testes locais, use `localhost:3001`.
- **Nome do bot**
- **WhatsApp** (formato: `5511999990000` — país + DDD + número, apenas dígitos)

Campos opcionais:
- **Avatar do bot** — upload de imagem (JPG, PNG, WebP ou GIF · máx. 2 MB). Armazenado em disco local (`uploads/avatars/`).
- Limite mensal de conversas (`0` ou vazio = ilimitado)
- **Mensagem no WhatsApp ao atingir o limite** — texto pré-preenchido no WhatsApp quando o visitante clica no botão de fallback. Máx. 500 caracteres.

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

### Filtros

| Filtro | Opções |
|---|---|
| **Busca** | Texto livre — pesquisa em nome e contato |
| **Site** | Todos os sites · site individual |
| **Período** | Hoje · 7 dias · 30 dias (padrão) · 90 dias · Todo período |

O botão **"Como funciona"** no cabeçalho exibe um resumo do ciclo de vida dos leads: qualificação automática, notificação por e-mail e exportação CSV.

**Colunas:** nome, contato, dados coletados, site, status de notificação por e-mail, data.

A coluna **Dados coletados** exibe todos os campos capturados para o lead (exceto nome e contato já mostrados separadamente). Campos além dos dois primeiros ficam ocultos e podem ser expandidos clicando em "+ N mais".

**Ícone de e-mail:**
- ✅ Verde → e-mail de notificação enviado
- ⚠️ Laranja → notificação não enviada (falha no SMTP)

**Exportar CSV:** baixa todos os leads com os filtros ativos (sem paginação). Compatível com Excel (BOM UTF-8).

---

## Sessões

Histórico de todas as conversas, com filtros identificados e replay completo.

### Filtros

| Filtro | Opções |
|---|---|
| **Site** | Todos os sites · site individual |
| **Status** | Todos · Ativa · Qualificada · Abandonada |
| **Período** | Hoje · 7 dias · 30 dias (padrão) · 90 dias · Todo período |

### Status de uma sessão

| Status | Significado |
|---|---|
| **Ativa** | Conversa em andamento — o visitante pode continuar enviando mensagens |
| **Qualificada** | Todos os campos obrigatórios foram preenchidos — lead registrado e e-mail enviado |
| **Abandonada** | Conversa encerrada sem qualificação — visitante saiu, pediu algo fora do escopo, ou simplesmente não continuou |

> Sessões **Ativas** sem nenhuma nova mensagem por **30 minutos** são marcadas automaticamente como **Abandonadas** pelo servidor. Isso cobre o caso comum de visitantes que fecham a aba sem interagir.

O botão **"Como funciona"** no cabeçalho da página exibe um resumo deste ciclo de vida diretamente no painel.

### Replay de conversa

Clique no ícone de mensagem em qualquer linha para abrir o painel lateral com:
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

O filtro afeta KPIs, gráficos de atividade, tipos de serviço e horários de pico.  
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
- **Tipos de serviço:** distribuição dos leads pelos valores coletados no campo de serviço
- **Horários de pico:** distribuição por hora do dia

### Últimos leads

Os 5 leads mais recentes. Na visão "todos os sites", exibe também o nome do site de origem.

---

## Visão por site

Acesse via **"Ver detalhes"** no menu de ações de qualquer site, ou selecione o site no Dashboard.

Idêntica ao Dashboard com site individual selecionado. Inclui adicionalmente o **Código de instalação** — snippet `<script>` pronto para copiar e colar no site do cliente.

---

## Configurações

Página para gerenciar os **campos de coleta** de cada site — quais informações o chatbot pergunta ao visitante, em qual ordem e quais são obrigatórias para qualificar o lead.

### Como funciona

Os campos configurados aqui controlam:
- O roteiro de perguntas do bot (via system prompt dinâmico)
- Quando um lead é considerado qualificado (todos os campos obrigatórios preenchidos)
- O texto da mensagem pré-preenchida no WhatsApp
- O que aparece na coluna "Dados coletados" na página de Leads

### Campos padrão

Ao criar um novo site, os seguintes campos são inseridos automaticamente:

| Ordem | Campo | Chave | Obrigatório |
|---|---|---|---|
| 1 | Nome do visitante | `nome_do_visitante` | ✅ |
| 2 | Tipo de serviço | `tipo_de_servico` | ✅ |
| 3 | Pessoa física ou empresa | `pessoa_fisica_ou_empresa` | ❌ |
| 4 | CNPJ | `cnpj` | ❌ |
| 5 | WhatsApp ou e-mail | `whatsapp_ou_e_mail` | ✅ |

### Gerenciar campos

- **Adicionar campo** → define nome, chave (gerada automaticamente) e instrução para o bot
- **Editar** → atualiza nome, instrução e obrigatoriedade (chave não pode ser alterada)
- **Reordenar** → botões ↑↓ por linha
- **Remover** → exige digitar **SIM** para confirmar
- **Restaurar padrões** → apaga todos os campos e recria os 5 padrões (exige **SIM**)

### Instrução para o bot (hint)

Campo de texto livre que diz ao bot como coletar e interpretar aquela informação. Exemplos:

> Para "Tipo de serviço":
> *"Pergunte qual tipo de serviço o visitante precisa. Exemplos: site, sistema, hospedagem. Aceite a resposta como está."*

> Para "Segmento de mercado":
> *"Pergunte em qual segmento o cliente atua. Exemplos: saúde, educação, varejo, tecnologia."*

### Chave do campo

Identificador único em snake_case, gerado automaticamente a partir do nome (`"Tipo de serviço"` → `tipo_de_servico`). Visível na tabela para referência. Não pode ser alterado após a criação.

---

## E-mail / SMTP

Página para configurar o servidor de e-mail usado no envio de notificações de leads. As configurações são salvas no banco de dados e têm precedência sobre as variáveis de ambiente.

### Campos

| Campo | Descrição |
|---|---|
| **Servidor (host)** | Endereço do servidor SMTP (ex: `smtp.gmail.com`) |
| **Porta** | Porta SMTP — `587` (STARTTLS), `465` (SSL) ou `25` |
| **Usuário** | E-mail de autenticação no servidor SMTP |
| **Senha** | Senha SMTP — nunca exibida após salvar. Deixar em branco ao editar preserva a senha atual |
| **Remetente** | Nome e endereço exibidos no campo "De" (ex: `Chatbot <noreply@exemplo.com>`) |
| **E-mail de notificação** | Destinatário das notificações de novos leads |

### Status

O badge no topo da página indica:
- **Configurado** (verde) → usuário e senha estão salvos, notificações ativas
- **Não configurado** (cinza) → SMTP não configurado; leads não geram e-mail

### Testar envio

O botão **"Testar envio"** (visível após salvar com senha) envia um e-mail de teste para o endereço de notificação configurado e exibe o resultado diretamente na página.

### Prioridade de configuração

1. **Banco de dados** (painel admin) — tem precedência quando `user_email` e senha estão preenchidos
2. **Variáveis de ambiente** (`.env`) — fallback quando não há configuração no banco

> Alterar as configurações no painel tem efeito imediato — não é necessário reiniciar o servidor.

---

## Segurança

- JWT expira em 8 horas — ao expirar, o painel redireciona para o login automaticamente
- Após logout, o token é removido do `localStorage`
- Erros 401 da API limpam o token e redirecionam para o login
- Ações críticas (excluir, restaurar, regenerar token, remover campos, restaurar padrões) exigem confirmação digitada
