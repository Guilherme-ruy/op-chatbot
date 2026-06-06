import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSites } from '@/hooks/useSites'
import ClientFormDialog from '@/components/clients/ClientFormDialog'
import ConfirmDialog    from '@/components/clients/ConfirmDialog'
import TokenDisplay     from '@/components/clients/TokenDisplay'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Plus, MoreHorizontal, BarChart2, Pencil, Power, KeyRound, Trash2,
  RotateCcw, Copy, Check,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Site, SiteFormData } from '@/types/admin'

type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted'

function maskWhatsApp(n: string | null) {
  if (!n) return '—'
  return n.slice(0, 4) + '•'.repeat(Math.max(0, n.length - 6)) + n.slice(-2)
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const { sites, deletedSites, loading, loadingDeleted, error,
    fetchSites, fetchDeletedSites, create, update, remove, restore, regenerateToken } = useSites()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [formOpen,    setFormOpen]    = useState(false)
  const [formSaving,  setFormSaving]  = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Confirm dialog
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmConfig,  setConfirmConfig]  = useState({ title: '', message: '', label: '', color: 'error' as 'error' | 'success', action: async () => {} })

  // Token dialog
  const [tokenDialog,    setTokenDialog]    = useState(false)
  const [tokenDialogNew, setTokenDialogNew] = useState(false)
  const [newToken,       setNewToken]       = useState<string | null>(null)
  const [tokenCopied,    setTokenCopied]    = useState(false)

  useEffect(() => { fetchSites() }, [])

  // Carrega excluídos apenas quando o filtro é selecionado pela primeira vez
  useEffect(() => {
    if (statusFilter === 'deleted' && deletedSites.length === 0) {
      fetchDeletedSites()
    }
  }, [statusFilter])

  // Filtragem client-side (sem roundtrip ao backend)
  const filteredSites = useMemo(() => {
    if (statusFilter === 'active')   return sites.filter(s =>  s.active)
    if (statusFilter === 'inactive') return sites.filter(s => !s.active)
    return sites // 'all' — ativos + inativos
  }, [sites, statusFilter])

  const isDeletedView = statusFilter === 'deleted'

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() { setEditingSite(null); setFormOpen(true) }
  function openEdit(site: Site) { setEditingSite(site); setFormOpen(true) }

  async function handleSave(form: SiteFormData) {
    setFormSaving(true)
    try {
      if (editingSite) {
        await update(editingSite.id, form)
        toast.success('Site atualizado.')
      } else {
        const site = await create(form)
        setNewToken(site.token)
        setTokenDialogNew(true)
        setTokenDialog(true)
      }
      setFormOpen(false)
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Erro ao salvar.') }
    finally { setFormSaving(false) }
  }

  async function toggleActive(site: Site) {
    setActionLoading(site.id)
    try { await update(site.id, { active: !site.active }); toast.success(site.active ? 'Desativado.' : 'Ativado.') }
    catch { toast.error('Erro ao alterar status.') }
    finally { setActionLoading(null) }
  }

  function askDelete(site: Site) {
    setConfirmConfig({
      title: 'Excluir site', color: 'error', label: 'Excluir',
      message: `O site "${site.domain}" será removido da lista. Os dados são preservados e o site pode ser restaurado depois.`,
      action: async () => { await remove(site.id); toast.success('Site excluído.') },
    })
    setConfirmOpen(true)
  }

  function askRestore(site: Site) {
    setConfirmConfig({
      title: 'Restaurar site', color: 'success', label: 'Restaurar',
      message: `O site "${site.domain}" será reativado e voltará a aparecer na lista.`,
      action: async () => {
        await restore(site.id)
        toast.success('Site restaurado.')
        setStatusFilter('all') // volta para a lista principal após restaurar
      },
    })
    setConfirmOpen(true)
  }

  async function executeConfirm() {
    setConfirmLoading(true)
    try { await confirmConfig.action(); setConfirmOpen(false) }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Erro ao executar.') }
    finally { setConfirmLoading(false) }
  }

  function handleRegenerateToken(site: Site) {
    setConfirmConfig({
      title: 'Regenerar token',
      color: 'error',
      label: 'Regenerar',
      message: `O token atual de "${site.name}" será invalidado na hora. Lembre-se de atualizar o script no site.`,
      action: async () => {
        const token = await regenerateToken(site.id)
        setNewToken(token)
        setTokenDialogNew(false)
        setTokenDialog(true)
      },
    })
    setConfirmOpen(true)
  }

  function copyToken() {
    if (newToken) {
      const snippet = `<script\n  src="${window.location.origin}/widget.js"\n  data-token="${newToken}"\n  defer\n></script>`
      navigator.clipboard.writeText(snippet)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isLoading = isDeletedView ? loadingDeleted : loading
  const rows      = isDeletedView ? deletedSites   : filteredSites
  const colSpan   = isDeletedView ? 5 : 9

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Sites</h1>
          <p className="text-sm text-muted-foreground">Gerencie os sites que utilizam o chatbot</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ativos e Inativos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="deleted">Excluídos</SelectItem>
            </SelectContent>
          </Select>
          {!isDeletedView && (
            <Button onClick={openCreate} size="sm">
              <Plus size={15} /> Novo site
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Tabela única — colunas adaptam ao filtro */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Domínio</TableHead>
              <TableHead>Bot</TableHead>
              {isDeletedView ? (
                <TableHead>Excluído em</TableHead>
              ) : (
                <>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Criado em</TableHead>
                </>
              )}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colSpan }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                  {isDeletedView
                    ? 'Nenhum site excluído.'
                    : statusFilter === 'inactive'
                      ? 'Nenhum site inativo.'
                      : 'Nenhum site cadastrado ainda.'}
                </TableCell>
              </TableRow>
            ) : isDeletedView ? (
              // ── Linhas de excluídos ──
              deletedSites.map(site => (
                <TableRow key={site.id} className="opacity-60">
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{site.domain}</TableCell>
                  <TableCell className="text-sm">{site.bot_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(site.deleted_at)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => askRestore(site)}>
                      <RotateCcw size={13} /> Restaurar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              // ── Linhas normais ──
              filteredSites.map(site => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{site.domain}</TableCell>
                  <TableCell className="text-sm">{site.bot_name}</TableCell>
                  <TableCell>
                    <Badge variant={site.active ? 'success' : 'secondary'}>
                      {site.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{site.total_sessions}</TableCell>
                  <TableCell className="text-right text-sm">{site.total_leads}</TableCell>
                  <TableCell><TokenDisplay token={site.token} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(site.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={actionLoading === site.id}>
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/clients/${site.id}`)}>
                          <BarChart2 size={14} className="text-blue-600" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(site)}>
                          <Pencil size={14} className="text-slate-600" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(site)}>
                          <Power size={14} className={site.active ? 'text-amber-600' : 'text-green-600'} />
                          {site.active ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRegenerateToken(site)}>
                          <KeyRound size={14} className="text-purple-600" /> Regenerar token
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => askDelete(site)} className="text-destructive focus:text-destructive">
                          <Trash2 size={14} /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <ClientFormDialog
        open={formOpen} onOpenChange={setFormOpen}
        site={editingSite} saving={formSaving} onSave={handleSave}
      />
      <ConfirmDialog
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title={confirmConfig.title} message={confirmConfig.message}
        confirmLabel={confirmConfig.label} color={confirmConfig.color}
        loading={confirmLoading} onConfirm={executeConfirm}
      />

      {/* Token dialog */}
      <Dialog open={tokenDialog} onOpenChange={v => { setTokenDialog(v); if (!v) setTokenCopied(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tokenDialogNew ? 'Site criado com sucesso!' : 'Novo token gerado'}</DialogTitle>
            <DialogDescription>
              {tokenDialogNew
                ? <>Cole o script abaixo no site antes do <code className="text-xs bg-slate-100 px-1 rounded">&lt;/body&gt;</code>:</>
                : <>Token anterior <strong>já não funciona</strong>. Atualize o script no site:</>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-slate-900 rounded-lg p-4">
            <code className="text-xs text-green-400 flex-1 font-mono leading-relaxed whitespace-pre-wrap break-all">{
`<script\n  src="${window.location.origin}/widget.js"\n  data-token="${newToken}"\n  defer\n></script>`
            }</code>
            <Button
              variant="ghost" size="icon"
              onClick={copyToken}
              className="text-slate-400 hover:text-white flex-shrink-0 h-7 w-7"
            >
              {tokenCopied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTokenDialog(false)}>Feito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
