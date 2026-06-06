import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLeads } from '@/hooks/useLeads'
import { useSites } from '@/hooks/useSites'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Download, Search, X, Filter, Mail, MailX,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  HelpCircle, UserCheck, FileDown,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Lead } from '@/types/admin'

// ── Períodos ──────────────────────────────────────────────────────────────────

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
  d.setDate(d.getDate() - days + 1) // +1 para incluir hoje
  return d.toISOString().slice(0, 10)
}

/** Converte dias → dateTo (só "Hoje" precisa de upper bound) */
function periodToDateTo(days: PeriodDays): string | undefined {
  if (days === 1) return new Date().toISOString().slice(0, 10)
  return undefined
}

// ── CollectedDataCell ─────────────────────────────────────────────────────────

function CollectedDataCell({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false)

  const MAIN_KEYS = new Set(['name', 'contact'])
  const extra = Object.entries(lead.custom_data ?? {})
    .filter(([k, v]) => !MAIN_KEYS.has(k) && v)

  if (extra.length === 0) return <span className="text-muted-foreground text-xs">—</span>

  const visible = expanded ? extra : extra.slice(0, 2)
  const hasMore = extra.length > 2

  return (
    <div className="space-y-0.5 text-xs">
      {visible.map(([k, v]) => (
        <div key={k} className="flex gap-1.5 leading-snug">
          <span className="text-muted-foreground capitalize whitespace-nowrap">{k.replace(/_/g, ' ')}:</span>
          <span className="font-medium">{String(v)}</span>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          {expanded
            ? <><ChevronUp size={10} /> menos</>
            : <><ChevronDown size={10} /> +{extra.length - 2} mais</>}
        </button>
      )}
    </div>
  )
}

// ── LeadsPage ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const {
    leads, total, loading, exporting, fetchError, exportError,
    filters, updateFilters, fetchLeads, exportCSV,
  } = useLeads()
  const { sites, fetchSites } = useSites()

  const [searchInput, setSearchInput] = useState('')
  const [period,      setPeriod]      = useState<PeriodDays>(30)
  const [helpOpen,    setHelpOpen]    = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const totalPages = Math.ceil(total / (filters.limit ?? 20))
  const hasFilters = !!(filters.siteId || searchInput || period !== 30)

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
    fetchLeads(next)
  }

  function onSearchChange(val: string) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      updateFilters({ search: val || undefined, page: 1 })
      fetchLeads({ ...filters, search: val || undefined, page: 1 })
    }, 400)
  }

  function clearSearch() {
    clearTimeout(searchTimer.current)
    setSearchInput('')
    updateFilters({ search: undefined, page: 1 })
    fetchLeads({ ...filters, search: undefined, page: 1 })
  }

  function applyFilter(key: string, val: string | undefined) {
    const next = { ...filters, [key]: val || undefined, page: 1 }
    updateFilters({ [key]: val || undefined, page: 1 })
    fetchLeads(next)
  }

  function handleClearAll() {
    clearTimeout(searchTimer.current)
    setSearchInput('')
    setPeriod(30)
    const dateFrom = periodToDateFrom(30)
    // Usa updateFilters direto (não resetFilters) para preservar dateFrom no hook
    updateFilters({ siteId: undefined, dateFrom, dateTo: undefined, search: undefined, page: 1 })
    fetchLeads({ siteId: undefined, dateFrom, dateTo: undefined, search: undefined, page: 1, limit: 20 })
  }

  async function handleExport() {
    try { await exportCSV() }
    catch { toast.error('Erro ao exportar CSV.') }
  }

  function goPage(p: number) {
    updateFilters({ page: p })
    fetchLeads({ ...filters, page: p })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">
              Todos os leads qualificados
              {total > 0 && <Badge variant="secondary" className="ml-2">{total}</Badge>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={14} /> Como funciona
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border bg-white shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Busca */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Busca</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={e => onSearchChange(e.target.value)}
                  placeholder="Nome ou contato..."
                  className="pl-8 pr-8 h-8 text-sm"
                />
                {searchInput && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

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

        {fetchError  && <Alert variant="destructive"><AlertDescription>{fetchError}</AlertDescription></Alert>}
        {exportError && <Alert variant="warning"><AlertDescription>{exportError}</AlertDescription></Alert>}

        {/* Tabela */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Dados coletados</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhum lead encontrado.
                  </TableCell>
                </TableRow>
              ) : leads.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.contact ?? '—'}</TableCell>
                  <TableCell><CollectedDataCell lead={lead} /></TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{lead.site_name}</div>
                    <div className="text-xs text-muted-foreground">{lead.site_domain}</div>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger>
                        {lead.notified_at
                          ? <Mail size={15} className="text-green-600" />
                          : <MailX size={15} className="text-amber-500" />}
                      </TooltipTrigger>
                      <TooltipContent>
                        {lead.notified_at ? 'E-mail enviado' : 'Aguardando envio'}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                {total} leads — página {filters.page} de {totalPages}
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
                Como funcionam os leads
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Um lead é registrado automaticamente quando o bot coleta todos os campos
                obrigatórios configurados para o site.
              </p>

              <div className="space-y-3">

                <div className="flex gap-3 p-3 rounded-lg border bg-green-50">
                  <UserCheck size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-700">Qualificação automática</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Assim que o visitante fornece todos os campos obrigatórios (configurados em{' '}
                      <strong>Configurações</strong>), o lead é salvo instantaneamente — sem nenhuma
                      ação manual necessária.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border bg-slate-50">
                  <Mail size={18} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Notificação por e-mail</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Um e-mail com os dados do lead é enviado automaticamente. O ícone{' '}
                      <strong className="text-green-600">verde</strong> indica envio bem-sucedido;{' '}
                      <strong className="text-amber-500">laranja</strong> indica falha no envio
                      (problema de SMTP ou configuração).
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border bg-slate-50">
                  <FileDown size={18} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Exportar CSV</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      O botão <strong>Exportar CSV</strong> baixa todos os leads com os filtros
                      ativos — sem limite de paginação. O arquivo é compatível com Excel
                      (UTF-8 com BOM).
                    </p>
                  </div>
                </div>

              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 flex gap-2">
                <HelpCircle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  Os campos exibidos em <strong>Dados coletados</strong> dependem da
                  configuração de cada site. Acesse <strong>Configurações</strong> na sidebar
                  para ajustar quais informações o bot coleta.
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  )
}
