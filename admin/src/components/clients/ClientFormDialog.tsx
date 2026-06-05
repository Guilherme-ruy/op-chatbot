import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Site, SiteFormData } from '@/types/admin'

const schema = z.object({
  name:           z.string().min(1, 'Obrigatório'),
  domain: z.string().min(1, 'Obrigatório')
    .transform(v => v.replace(/^https?:\/\//, '').replace(/\/$/, '').trim())
    .refine(
      v =>
        /^localhost(:\d+)?$/.test(v) ||
        /^127\.0\.0\.1(:\d+)?$/.test(v) ||
        /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?$/.test(v),
      'Domínio inválido (ex: clinicasilva.com.br ou localhost:3001)'
    ),
  bot_name:       z.string().min(1, 'Obrigatório'),
  bot_avatar_url: z.string().nullable().optional(),
  whatsapp_number: z.string().regex(/^\d{10,15}$/, 'Apenas dígitos, 10–15 chars'),
  monthly_session_limit: z.preprocess(
    v => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) || n === 0 ? null : n; // 0 = ilimitado
    },
    z.number().int().min(1).nullable().optional()
  ),
  limit_message: z.string().max(500).nullable().optional(),
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
        monthly_session_limit: site.monthly_session_limit,
        limit_message: site.limit_message,
      } : { name: '', domain: '', bot_name: '', bot_avatar_url: '', whatsapp_number: '', monthly_session_limit: undefined, limit_message: undefined })
    }
  }, [open, site, reset])

  function onSubmit(data: FormValues) {
    onSave(data as SiteFormData)
  }

  // Permite apenas dígitos no campo
  function onlyDigits(e: React.FormEvent<HTMLInputElement>) {
    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '')
  }

  return (
    <Dialog open={open} onOpenChange={v => !saving && onOpenChange(v)}>
      <DialogContent hideCloseButton className="max-w-lg flex flex-col gap-0 p-0 max-h-[90vh] overflow-hidden">

        <DialogHeader className="flex-none px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEdit ? 'Editar site' : 'Novo site'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <Field label="Nome do site *" error={errors.name?.message}>
              <Input {...register('name')} placeholder="Ex: Clínica Silva" />
            </Field>
            <Field label="Domínio *" error={errors.domain?.message}>
              <Input {...register('domain')} placeholder="Ex: clinicasilva.com.br ou localhost:3001" />
              <p className="text-xs text-muted-foreground mt-1">Ex: clinicasilva.com.br ou localhost:3001</p>
            </Field>
            <Field label="Nome do bot *" error={errors.bot_name?.message}>
              <Input {...register('bot_name')} placeholder="Ex: Ana da Clínica Silva" />
            </Field>
            <Field label="URL do avatar (opcional)" error={errors.bot_avatar_url?.message}>
              <Input {...register('bot_avatar_url')} placeholder="https://..." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp *" error={errors.whatsapp_number?.message}>
                <Input
                  {...register('whatsapp_number')}
                  type="tel"
                  inputMode="numeric"
                  placeholder="5511999990000"
                  onInput={onlyDigits}
                />
                <p className="text-xs text-muted-foreground mt-1">País + DDD + número (ex: 5511999990000)</p>
              </Field>
              <Field label="Limite mensal de conversas" error={errors.monthly_session_limit?.message}>
                <Input
                  {...register('monthly_session_limit')}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0 = ilimitado"
                  onInput={onlyDigits}
                />
              </Field>
            </div>

            <Field label="Mensagem ao atingir o limite (opcional)" error={errors.limit_message?.message}>
              <Input
                {...register('limit_message')}
                placeholder="Ex: Olá! No momento não conseguimos atender. Fale conosco pelo WhatsApp!"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece na bolha do widget quando o limite mensal é atingido.</p>
            </Field>
          </div>

          <DialogFooter className="flex-none border-t px-6 py-4 bg-background">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar site'}
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
