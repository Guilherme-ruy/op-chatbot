import { useEffect } from 'react'
import { useSessions } from '@/hooks/useSessions'
import { useSites } from '@/hooks/useSites'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MessageSquare, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatDate, formatDateTime, formatTime } from '@/lib/utils'
import type { Session } from '@/types/admin'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
  active: 'default', qualified: 'success', abandoned: 'secondary',
}
const STATUS_LABEL: Record<string, string> = { active: 'Ativa', qualified: 'Qualificada', abandoned: 'Abandonada' }
const FIELD_LABEL: Record<string, string> = {
  name: 'Nome', projectType: 'Projeto', clientType: 'Perfil', cnpj: 'CNPJ', contact: 'Contato', budget: 'Orçamento',
}

export default function SessionsPage() {
  const {
    sessions, total, loading, error, filters, updateFilters, fetchSessions, resetFilters,
    selectedSession, messages, loadingMessages, replayError, openReplay, closeReplay,
  } = useSessions()
  const { sites, fetchSites } = useSites()
  const totalPages = Math.ceil(total / (filters.limit ?? 25))
  const hasFilters = !!(filters.siteId || filters.status || filters.dateFrom || filters.dateTo)

  useEffect(() => { fetchSites(); fetchSessions() }, [])

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
    resetFilters()
    fetchSessions({ siteId: undefined, status: undefined, dateFrom: undefined, dateTo: undefined, page: 1, limit: 25 })
  }

  const collectedEntries = (s: Session) =>
    Object.entries(s.collected_data ?? {}).filter(([, v]) => v)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Sessões</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de conversas
          {total > 0 && <Badge variant="secondary" className="ml-2">{total}</Badge>}
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white shadow-sm p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Select value={filters.siteId ?? '__all__'} onValueChange={v => applyFilter('siteId', v === '__all__' ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Todos os sites" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os sites</SelectItem>
              {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.status ?? '__all__'} onValueChange={v => applyFilter('status', v === '__all__' ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="qualified">Qualificadas</SelectItem>
              <SelectItem value="abandoned">Abandonadas</SelectItem>
            </SelectContent>
          </Select>

          <Input type="date" value={filters.dateFrom ?? ''} onChange={e => applyFilter('dateFrom', e.target.value)} />
          <Input type="date" value={filters.dateTo   ?? ''} onChange={e => applyFilter('dateTo',   e.target.value)} />
        </div>
        {hasFilters && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-muted-foreground h-7">
              <X size={12} /> Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

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
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma sessão encontrada.</TableCell></TableRow>
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
            <span className="text-sm text-muted-foreground">{total} sessões — página {filters.page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" disabled={filters.page === 1} onClick={() => goPage((filters.page ?? 1) - 1)}>
                <ChevronLeft size={15} />
              </Button>
              <Button variant="outline" size="icon" disabled={filters.page === totalPages} onClick={() => goPage((filters.page ?? 1) + 1)}>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Replay Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={v => { if (!v) closeReplay() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          {selectedSession && (
            <>
              <SheetHeader className="px-5 py-4 border-b flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-base">{selectedSession.site_name}</SheetTitle>
                    <Badge variant={STATUS_VARIANT[selectedSession.status] ?? 'secondary'} className="mt-1">
                      {STATUS_LABEL[selectedSession.status]}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              {/* Dados coletados */}
              {collectedEntries(selectedSession).length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-b flex-shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dados coletados</p>
                  <div className="space-y-1">
                    {collectedEntries(selectedSession).map(([key, val]) => (
                      <div key={key} className="flex gap-3 text-xs">
                        <span className="text-muted-foreground w-16 flex-shrink-0">{FIELD_LABEL[key] ?? key}</span>
                        <span className="font-medium">{String(val)}</span>
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
                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'items-start'}`}>
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
