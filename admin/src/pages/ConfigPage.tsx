import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSites } from '@/hooks/useSites'
import { getSiteFields, createSiteField, updateSiteField, deleteSiteField, reorderSiteFields, resetSiteFields } from '@/api/fields'
import type { SiteField, SiteFieldFormData } from '@/types/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import ConfirmDialog from '@/components/clients/ConfirmDialog'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, RotateCcw, GripVertical, Info } from 'lucide-react'

// Slug automático a partir do label
function toSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

const EMPTY_FORM: SiteFieldFormData = { key: '', label: '', hint: '', required: true }

export default function ConfigPage() {
  const { sites, fetchSites } = useSites()

  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [fields,         setFields]         = useState<SiteField[]>([])
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  // Form dialog
  const [formOpen,    setFormOpen]    = useState(false)
  const [formSaving,  setFormSaving]  = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [form,        setForm]        = useState<SiteFieldFormData>(EMPTY_FORM)

  // Confirm dialog (delete / reset)
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmConfig,  setConfirmConfig]  = useState({
    title: '', message: '', label: '', color: 'error' as 'error' | 'success',
    action: async () => {},
  })

  useEffect(() => { fetchSites() }, [])

  useEffect(() => {
    if (!selectedSiteId) { setFields([]); return }
    loadFields(selectedSiteId)
  }, [selectedSiteId])

  async function loadFields(siteId: string) {
    setLoading(true); setError(null)
    try   { setFields(await getSiteFields(siteId)) }
    catch { setError('Erro ao carregar campos.') }
    finally { setLoading(false) }
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(field: SiteField) {
    setEditingId(field.id)
    setForm({ key: field.key, label: field.label, hint: field.hint ?? '', required: field.required })
    setFormOpen(true)
  }

  function handleLabelChange(label: string) {
    // Chave sempre gerada automaticamente a partir do label
    setForm(f => ({ ...f, label, key: toSlug(label) }))
  }

  async function handleSave() {
    if (!selectedSiteId) return
    if (!form.key.trim() || !form.label.trim()) {
      toast.error('Chave e nome do campo são obrigatórios.')
      return
    }
    setFormSaving(true)
    try {
      if (editingId) {
        const updated = await updateSiteField(selectedSiteId, editingId, {
          label: form.label.trim(),
          hint: form.hint?.trim() || null,
          required: form.required,
        })
        setFields(fs => fs.map(f => f.id === editingId ? updated : f))
        toast.success('Campo atualizado.')
      } else {
        const created = await createSiteField(selectedSiteId, {
          ...form,
          key: form.key.trim(),
          label: form.label.trim(),
          hint: form.hint?.trim() || null,
          sort_order: fields.length,
        })
        setFields(fs => [...fs, created])
        toast.success('Campo criado.')
      }
      setFormOpen(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Erro ao salvar campo.')
    } finally {
      setFormSaving(false)
    }
  }

  // ── Reordenação ──────────────────────────────────────────────────────────────

  async function move(index: number, dir: -1 | 1) {
    if (!selectedSiteId) return
    const next = [...fields]
    const swapIndex = index + dir
    if (swapIndex < 0 || swapIndex >= next.length) return
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    setFields(next)
    try {
      await reorderSiteFields(selectedSiteId, next.map(f => f.id))
    } catch {
      toast.error('Erro ao reordenar campos.')
      loadFields(selectedSiteId)
    }
  }

  // ── Exclusão ─────────────────────────────────────────────────────────────────

  function askDelete(field: SiteField) {
    setConfirmConfig({
      title: 'Remover campo',
      color: 'error',
      label: 'Remover',
      message: `O campo "${field.label}" será removido dos campos de coleta deste site. Leads já criados não são afetados.`,
      action: async () => {
        await deleteSiteField(selectedSiteId, field.id)
        setFields(fs => fs.filter(f => f.id !== field.id))
        toast.success('Campo removido.')
      },
    })
    setConfirmOpen(true)
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function askReset() {
    setConfirmConfig({
      title: 'Restaurar padrões',
      color: 'error',
      label: 'Restaurar',
      message: 'Todos os campos atuais serão removidos e os campos padrão serão restaurados. Leads já criados não são afetados.',
      action: async () => {
        const defaults = await resetSiteFields(selectedSiteId)
        setFields(defaults)
        toast.success('Campos restaurados para os padrões.')
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

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedSite = sites.find(s => s.id === selectedSiteId)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Campos de coleta configuráveis por site</p>
        </div>
        <Select value={selectedSiteId || '__none__'} onValueChange={v => setSelectedSiteId(v === '__none__' ? '' : v)}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue placeholder="Selecione um site…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" disabled>Selecione um site…</SelectItem>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSiteId && (
        <div className="rounded-xl border bg-white shadow-sm p-12 text-center text-muted-foreground">
          <GripVertical size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione um site para configurar os campos de coleta do chatbot.</p>
        </div>
      )}

      {selectedSiteId && (
        <>
          {/* Info card */}
          <Alert className="border-blue-200 bg-blue-50">
            <Info size={15} className="text-blue-600" />
            <AlertDescription className="text-blue-800 text-xs">
              Os campos abaixo determinam quais informações o bot coletará durante a conversa e em qual ordem.
              O bot só considera o lead qualificado quando todos os campos <strong>obrigatórios</strong> forem preenchidos.
            </AlertDescription>
          </Alert>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {/* Tabela de campos */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <p className="text-sm font-semibold">{selectedSite?.name}</p>
                <p className="text-xs text-muted-foreground">{fields.length} campo{fields.length !== 1 ? 's' : ''} configurado{fields.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={askReset} className="h-7 text-xs text-muted-foreground">
                  <RotateCcw size={12} /> Restaurar padrões
                </Button>
                <Button size="sm" onClick={openCreate} className="h-7 text-xs">
                  <Plus size={13} /> Adicionar campo
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Nome do campo</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Instrução para o bot</TableHead>
                  <TableHead>Obrigatório</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : fields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                      Nenhum campo configurado. Clique em "Adicionar campo" ou "Restaurar padrões".
                    </TableCell>
                  </TableRow>
                ) : fields.map((field, i) => (
                  <TableRow key={field.id}>
                    {/* Ordem */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={i === fields.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </TableCell>

                    {/* Label */}
                    <TableCell className="font-medium text-sm">{field.label}</TableCell>

                    {/* Key */}
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{field.key}</code>
                    </TableCell>

                    {/* Hint */}
                    <TableCell className="text-xs text-muted-foreground max-w-64">
                      {field.hint
                        ? <span title={field.hint}>{field.hint.length > 80 ? field.hint.slice(0, 80) + '…' : field.hint}</span>
                        : <span className="italic opacity-50">—</span>
                      }
                    </TableCell>

                    {/* Required */}
                    <TableCell>
                      <Badge variant={field.required ? 'default' : 'secondary'} className="text-xs">
                        {field.required ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>

                    {/* Ações */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(field)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => askDelete(field)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Dialog: criar / editar campo */}
      <Dialog open={formOpen} onOpenChange={v => { if (!formSaving) setFormOpen(v) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar campo' : 'Novo campo'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize as propriedades do campo. A chave não pode ser alterada.'
                : 'Defina as propriedades do campo de coleta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-1.5">
              <Label>Nome do campo <span className="text-destructive">*</span></Label>
              <Input
                value={form.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="Ex: Tipo de serviço"
              />
            </div>

            {/* Key */}
            <div className="space-y-1.5">
              <Label>Chave (identificador)</Label>
              <Input
                value={form.key}
                readOnly
                placeholder="gerado automaticamente…"
                className="bg-slate-50 text-muted-foreground cursor-default"
              />
              <p className="text-xs text-muted-foreground">
                Gerado automaticamente a partir do nome. Não pode ser alterado após a criação.
              </p>
            </div>

            {/* Hint */}
            <div className="space-y-1.5">
              <Label>Instrução para o bot <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                value={form.hint ?? ''}
                onChange={e => setForm(f => ({ ...f, hint: e.target.value }))}
                placeholder="Ex: Pergunte qual tipo de serviço o visitante precisa. Valores esperados: site, sistema, hospedagem, outro."
                rows={3}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Instrução que o bot usa para coletar e interpretar este campo. Inclua valores esperados, formato, etc.
              </p>
            </div>

            {/* Required */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Campo obrigatório</p>
                <p className="text-xs text-muted-foreground">O lead só será qualificado quando este campo estiver preenchido</p>
              </div>
              <Switch
                checked={form.required}
                onCheckedChange={v => setForm(f => ({ ...f, required: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={formSaving}>
              {formSaving ? 'Salvando…' : editingId ? 'Salvar' : 'Criar campo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title={confirmConfig.title} message={confirmConfig.message}
        confirmLabel={confirmConfig.label} color={confirmConfig.color}
        loading={confirmLoading} onConfirm={executeConfirm}
      />
    </div>
  )
}
