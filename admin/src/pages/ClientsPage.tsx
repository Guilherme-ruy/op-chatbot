import { useEffect, useState } from 'react'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Plus, MoreHorizontal, BarChart2, Pencil, Power, KeyRound, Trash2,
  ChevronDown, RotateCcw, Copy, Check,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Site, SiteFormData } from '@/types/admin'

function maskWhatsApp(n: string | null) {
  if (!n) return '—'
  return n.slice(0, 4) + '•'.repeat(Math.max(0, n.length - 6)) + n.slice(-2)
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const { sites, deletedSites, loading, loadingDeleted, error,
    fetchSites, fetchDeletedSites, create, update, remove, restore, regenerateToken } = useSites()

  const [formOpen,   setFormOpen]   = useState(false)
  const [formSaving, setFormSaving] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletedOpen, setDeletedOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Confirm dialog
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmConfig,  setConfirmConfig]  = useState({ title: '', message: '', label: '', color: 'error' as 'error' | 'success', action: async () => {} })

  // Token dialog
  const [tokenDialog, setTokenDialog] = useState(false)
  const [newToken,    setNewToken]    = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  useEffect(() => { fetchSites() }, [])

  function openCreate() { setEditingSite(null); setFormOpen(true) }
  function openEdit(site: Site) { setEditingSite(site); setFormOpen(true) }

  async function handleSave(form: SiteFormData) {
    setFormSaving(true)
    try {
      if (editingSite) { await update(editingSite.id, form); toast.success('Site atualizado.') }
      else             { await create(form);                 toast.success('Site criado.') }
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
      action: async () => { await restore(site.id); toast.success('Site restaurado.') },
    })
    setConfirmOpen(true)
  }

  async function executeConfirm() {
    setConfirmLoading(true)
    try { await confirmConfig.action(); setConfirmOpen(false) }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Erro ao executar.') }
    finally { setConfirmLoading(false) }
  }

  async function handleRegenerateToken(site: Site) {
    setActionLoading(site.id)
    try { setNewToken(await regenerateToken(site.id)); setTokenDialog(true) }
    catch { toast.error('Erro ao regenerar token.') }
    finally { setActionLoading(null) }
  }

  function toggleDeleted() {
    setDeletedOpen(v => !v)
    if (!deletedOpen && deletedSites.length === 0) fetchDeletedSites()
  }

  function copyToken() {
    if (newToken) { navigator.clipboard.writeText(newToken); setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000) }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sites</h1>
          <p className="text-sm text-muted-foreground">Gerencie os sites que utilizam o chatbot</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={15} /> Novo site
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Tabela de ativos */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Domínio</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Sessões</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : sites.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Nenhum cliente cadastrado ainda.</TableCell></TableRow>
            ) : sites.map(site => (
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Sites excluídos */}
      <Collapsible open={deletedOpen} onOpenChange={toggleDeleted}>
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50 transition-colors">
            <span className="text-sm font-medium text-muted-foreground">Sites excluídos</span>
            <ChevronDown size={16} className={`text-muted-foreground transition-transform ${deletedOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Excluído em</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDeleted ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Carregando...</TableCell></TableRow>
                  ) : deletedSites.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Nenhum cliente excluído.</TableCell></TableRow>
                  ) : deletedSites.map(site => (
                    <TableRow key={site.id} className="opacity-70">
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
            <DialogTitle>Novo token gerado</DialogTitle>
            <DialogDescription>
              Copie o token abaixo e atualize o snippet do site do cliente. <strong>Este token não será exibido novamente.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border font-mono text-sm break-all">
            <span className="flex-1 text-xs">{newToken}</span>
            <Button variant="ghost" size="icon" onClick={copyToken} className="flex-shrink-0">
              {tokenCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
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
