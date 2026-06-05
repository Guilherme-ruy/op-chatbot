import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { Site, SiteFormData } from '@/types/admin'

const schema = z.object({
  name:                  z.string().min(1, 'Obrigatório'),
  domain:                z.string().regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Domínio inválido (ex: site.com.br)'),
  bot_name:              z.string().min(1, 'Obrigatório'),
  bot_avatar_url:        z.string().nullable().optional(),
  whatsapp_number:       z.string().regex(/^\d{10,15}$/, 'Apenas dígitos, 10–15 chars (ex: 5511999990000)'),
  plan_name:             z.string().nullable().optional(),
  monthly_session_limit: z.preprocess(
    v => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).nullable().optional()
  ),
})

type FormValues = z.infer<typeof schema>

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  site?: Site | null
  saving?: boolean
  onSave: (form: SiteFormData) => void
}

export default function ClientFormDialog({ open, onOpenChange, site, saving, onSave }: ClientFormDialogProps) {
  const isEdit = !!site

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset(site ? {
        name: site.name, domain: site.domain, bot_name: site.bot_name,
        bot_avatar_url: site.bot_avatar_url, whatsapp_number: site.whatsapp_number ?? '',
        plan_name: site.plan_name, monthly_session_limit: site.monthly_session_limit,
      } : { name: '', domain: '', bot_name: '', bot_avatar_url: '', whatsapp_number: '', plan_name: '', monthly_session_limit: undefined })
    }
  }, [open, site, reset])

  function onSubmit(data: FormValues) {
    onSave(data as SiteFormData)
  }

  return (
    <Dialog open={open} onOpenChange={v => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nome do cliente *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Ex: Clínica Silva" />
          </Field>
          <Field label="Domínio *" error={errors.domain?.message}>
            <Input {...register('domain')} placeholder="Ex: clinicasilva.com.br" />
            <p className="text-xs text-muted-foreground mt-1">Sem http:// — apenas o domínio</p>
          </Field>
          <Field label="Nome do bot *" error={errors.bot_name?.message}>
            <Input {...register('bot_name')} placeholder="Ex: Ana da Clínica Silva" />
          </Field>
          <Field label="URL do avatar (opcional)" error={errors.bot_avatar_url?.message}>
            <Input {...register('bot_avatar_url')} placeholder="https://..." />
          </Field>
          <Field label="WhatsApp *" error={errors.whatsapp_number?.message}>
            <Input {...register('whatsapp_number')} placeholder="Ex: 5511999990000" />
            <p className="text-xs text-muted-foreground mt-1">Código do país + DDD + número, sem espaços</p>
          </Field>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plano e Limites</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do plano" error={errors.plan_name?.message}>
              <Input {...register('plan_name')} placeholder="Ex: Básico, Pro" />
            </Field>
            <Field label="Limite mensal" error={errors.monthly_session_limit?.message}>
              <Input {...register('monthly_session_limit')} type="number" min={1} placeholder="Vazio = ilimitado" />
            </Field>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
