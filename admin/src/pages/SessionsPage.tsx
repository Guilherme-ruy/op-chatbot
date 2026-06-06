import { useEffect, useState } from 'react'
import { useSessions } from '@/hooks/useSessions'
import { useSites } from '@/hooks/useSites'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MessageSquare, ChevronLeft, ChevronRight, X, Filter, HelpCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn, formatDateTime, formatTime } from '@/lib/utils'
import type { Session } from '@/types/admin'

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
  active: 'default', qualified: 'success', abandoned: 'secondary',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa', qualified: 'Qualificada', abandoned: 'Abandonada',
}

const PERIODS = [
  { label: 'Hoje',         days: 1  },
  { label: '7 dias',       days: 7  },
  { label: '30 dias',      days: 30 },
  { label: '90 dias',      days: 90 },
  { label: 'Todo período', days: 0  },
] as const

type PeriodDays = typeof PERIODS[number]['days']

/** Converte dias → dateFrom (string YYYY-MM-DD ou undefined) */
function periodToDateFrom(days: PeriodDays): string | undefined {
  if (days === 0) return undefined
  const d = new Date()
  d.setDate(d.getDate() - days + 1)   // +1 para incluir o dia de hoje
  return d.toISOString().slice(0, 10)
}

/** Converte dias → dateTo (só "Hoje" precisa de upper bound) */
function periodToDateTo(days: PeriodDays): string | undefined {
  if (days === 1) return new Date().toISOString().slice(0, 10)
  return undefined
}

/** Formata chave de campo dinâmico para exibição legível */
function formatFieldKey(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const {
    sessions, total, loading, error, filters, updateFilters, fetchSessions, resetFilters,
    selectedSession, messages, loadingMessages, replayError, openReplay, closeReplay,
  } = useSessions()
  const { sites, fetchSites } = useSites()

  const [period,      setPeriod]      = useState<PeriodDays>(30)
  const [helpOpen,    setHelpOpen]    = useState(false)

  const totalPages = Math.ceil(total / (filters.limit ?? 25))
  const hasFilters = !!(filters.siteId || filters.status || period !== 30)

  useEffect(() => { fetchSites(); applyPeriod(30) }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function applyPeriod(days: PeriodDays) {
    setPeriod(days)
    const next = {
      ...filters,
      dateFrom: periodToDateFrom(days),
      dateTo:   periodToDateTo(days),
      page: 1,
    }
    updateFilters({ dateFrom: next.dateFrom, dateTo: next.dateTo, page: 1 })
    fetchSessions(next)
  }

  function applyFilter(key: string, val: string | undefined) {
    const next = { ...filters, [key]: val || undefined, page: 1 }
    updateFilters({ [key]: val || undefined, page: 1 })
    fetchSessions(next)
  }

  function goPage(p: number) {
    updateFilters({ page: p })
    fetchSessions({ ...filters, page: p })
  }

  function handleClearAll() {
    setPeriod(30)
    resetFilters()
    fetchSessions({
      siteId: undefined, status: undefined,
      dateFrom: periodToDateFrom(30), dateTo: undefined,
      page: 1, limit: 25,
    })
  }

  const collectedEntries = (s: Session) =>
    Object.entries(s.collected_data ?? {}).filter(([, v]) => v)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Sessões</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de conversas
            {total > 0 && <Badge variant="secondary" className="ml-2">{total}</Badge>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
          <HelpCircle size={14} /> Como funciona
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Site */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Site</Label>
            <Select
              value={filters.siteId ?? '__all__'}
              onValueChange={v => applyFilter('siteId', v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos os sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os sites</SelectItem>
                {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filters.status ?? '__all__'}
              onValueChange={v => applyFilter('status', v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="qualified">Qualificadas</SelectItem>
                <SelectItem value="abandoned">Abandonadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select
              value={String(period)}
              onValueChange={v => applyPeriod(Number(v) as PeriodDays)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => (
                  <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-muted-foreground h-7 -mt-1">
            <X size={12} /> Limpar filtros
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Tabela */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Msgs</TableHead>
              <TableHead>Iniciada</TableHead>
              <TableHead>Atualizada</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}</TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhuma sessão encontrada.
                </TableCell>
              </TableRow>
            ) : sessions.map(session => (
              <TableRow key={session.id} className={selectedSession?.id === session.id ? 'bg-muted/50' : ''}>
                <TableCell>
                  <div className="font-medium text-sm">{session.site_name}</div>
                  <div className="text-xs text-muted-foreground">{session.site_domain}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[session.status] ?? 'secondary'}>
                    {STATUS_LABEL[session.status] ?? session.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">{session.message_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(session.created_at)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(session.updated_at)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon"
                    className={`h-7 w-7 ${selectedSession?.id === session.id ? 'text-primary' : ''}`}
                    onClick={() => openReplay(session)}
                  >
                    <MessageSquare size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              {total} sessões — página {filters.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline" size="icon"
                disabled={filters.page === 1}
                onClick={() => goPage((filters.page ?? 1) - 1)}
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                variant="outline" size="icon"
                disabled={filters.page === totalPages}
                onClick={() => goPage((filters.page ?? 1) + 1)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog: Como funciona */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle size={18} className="text-muted-foreground" />
              Como funcionam as sessões
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Uma sessão é criada cada vez que um visitante abre o chatbot. Ela passa por três possíveis status:
            </p>

            <div className="space-y-3">
              <div className="flex gap-3 p-3 rounded-lg border bg-slate-50">
                <Clock size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Ativa</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Conversa em andamento. O visitante está interagindo com o bot
                    ou acabou de iniciar a sessão.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 rounded-lg border bg-green-50">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-700">Qualificada</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    O visitante forneceu todos os campos obrigatórios configurados
                    para o site. Um lead foi registrado automaticamente e uma
                    notificação por e-mail foi disparada.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 rounded-lg border bg-slate-50">
                <XCircle size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-600">Abandonada</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    A conversa encerrou sem gerar um lead. Isso acontece quando o
                    visitante fecha o navegador, sai sem responder, pede um serviço
                    fora do escopo ou simplesmente não continua.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex gap-2">
              <Clock size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                Sessões ativas sem nenhuma nova mensagem por <strong>30 minutos</strong> são
                encerradas automaticamente como <strong>Abandonadas</strong> — isso cobre os casos em
                que o visitante fecha a aba sem interagir.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Replay Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={v => { if (!v) closeReplay() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          {selectedSession && (
            <>
              <SheetHeader className="px-5 py-4 border-b flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-base">{selectedSession.site_name}</SheetTitle>
                    <Badge
                      variant={STATUS_VARIANT[selectedSession.status] ?? 'secondary'}
                      className="mt-1"
                    >
                      {STATUS_LABEL[selectedSession.status]}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              {/* Dados coletados */}
              {collectedEntries(selectedSession).length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-b flex-shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Dados coletados
                  </p>
                  <div className="space-y-1">
                    {collectedEntries(selectedSession).map(([key, val]) => (
                      <div key={key} className="flex gap-3 text-xs">
                        <span className="text-muted-foreground min-w-0 flex-shrink-0 max-w-[120px] truncate">
                          {formatFieldKey(key)}
                        </span>
                        <span className="font-medium truncate">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : replayError ? (
                  <Alert variant="destructive"><AlertDescription>{replayError}</AlertDescription></Alert>
                ) : messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'items-start'}`}
                  >
                    <span className="text-xs text-muted-foreground mb-1">
                      {msg.role === 'user' ? 'Visitante' : 'Bot'} · {formatTime(msg.created_at)}
                    </span>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-green-500 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
