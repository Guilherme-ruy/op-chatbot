import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLeads } from '@/hooks/useLeads'
import { useSites } from '@/hooks/useSites'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Search, X, Filter, Mail, MailX, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const PROJECT_LABELS: Record<string, string> = { site: 'Site', sistema: 'Sistema', hospedagem: 'Hospedagem', outro: 'Outro' }
const PROJECT_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'secondary'> = {
  site: 'default', sistema: 'info', hospedagem: 'warning', outro: 'secondary',
}

export default function LeadsPage() {
  const { leads, total, loading, exporting, fetchError, exportError, filters, updateFilters, fetchLeads, exportCSV, resetFilters } = useLeads()
  const { sites, fetchSites } = useSites()
  const [searchInput, setSearchInput] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const totalPages = Math.ceil(total / (filters.limit ?? 20))
  const hasFilters = !!(filters.siteId || filters.dateFrom || filters.dateTo || filters.projectType || searchInput)

  useEffect(() => { fetchSites(); fetchLeads() }, [])

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
    resetFilters()
    fetchLeads({ siteId: undefined, dateFrom: undefined, dateTo: undefined, search: undefined, projectType: undefined, page: 1, limit: 20 })
  }

  async function handleExport() {
    try { await exportCSV() }
    catch { toast.error('Erro ao exportar CSV.') }
  }

  function goPage(p: number) {
    updateFilters({ page: p })
    fetchLeads({ ...filters, page: p })
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">
              Todos os leads qualificados
              {total > 0 && <Badge variant="secondary" className="ml-2">{total}</Badge>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative col-span-2 lg:col-span-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Nome ou contato..."
                className="pl-8 pr-8"
              />
              {searchInput && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>

            <Select value={filters.siteId ?? '__all__'} onValueChange={v => applyFilter('siteId', v === '__all__' ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Todos os sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os sites</SelectItem>
                {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.projectType ?? '__all__'} onValueChange={v => applyFilter('projectType', v === '__all__' ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Tipo de projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
                <SelectItem value="hospedagem">Hospedagem</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
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

        {fetchError  && <Alert variant="destructive"><AlertDescription>{fetchError}</AlertDescription></Alert>}
        {exportError && <Alert variant="warning"><AlertDescription>{exportError}</AlertDescription></Alert>}

        {/* Tabela */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Data</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
              ) : leads.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.contact ?? '—'}</TableCell>
                  <TableCell>
                    {lead.project_type
                      ? <Badge variant={PROJECT_VARIANT[lead.project_type] ?? 'secondary'}>{PROJECT_LABELS[lead.project_type] ?? lead.project_type}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {lead.client_type
                      ? <Badge variant="outline">{lead.client_type.toUpperCase()}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{lead.budget ?? '—'}</TableCell>
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
                      <TooltipContent>{lead.notified_at ? 'E-mail enviado' : 'Aguardando envio'}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(lead.created_at)}</TableCell>
                  <TableCell>
                    {lead.whatsapp_url && (
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-green-600">
                        <a href={lead.whatsapp_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">{total} leads — página {filters.page} de {totalPages}</span>
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
      </div>
    </TooltipProvider>
  )
}
