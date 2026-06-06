import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadAvatar, deleteAvatar } from '@/api/sites'
import type { Site, SiteFormData } from '@/types/admin'
import { ImagePlus, X } from 'lucide-react'

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
      return isNaN(n) || n === 0 ? null : n;
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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  // Avatar local — File selecionado ainda não enviado
  const [pendingFile,    setPendingFile]    = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [uploadError,    setUploadError]    = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const avatarUrl = watch('bot_avatar_url')

  useEffect(() => {
    if (open) {
      setPendingFile(null)
      setPendingPreview(null)
      setUploadError(null)
      reset(site ? {
        name: site.name, domain: site.domain, bot_name: site.bot_name,
        bot_avatar_url: site.bot_avatar_url, whatsapp_number: site.whatsapp_number ?? '',
        monthly_session_limit: site.monthly_session_limit,
        limit_message: site.limit_message,
      } : { name: '', domain: '', bot_name: '', bot_avatar_url: '', whatsapp_number: '',
            monthly_session_limit: undefined, limit_message: undefined })
    }
  }, [open, site, reset])

  function onlyDigits(e: React.FormEvent<HTMLInputElement>) {
    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Formato inválido. Use JPG, PNG, WebP ou GIF.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Arquivo muito grande. Máximo: 2 MB.')
      return
    }

    setUploadError(null)
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
  }

  function removeAvatar() {
    setPendingFile(null)
    setPendingPreview(null)
    setValue('bot_avatar_url', null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onSubmit(data: FormValues) {
    let finalAvatarUrl = data.bot_avatar_url ?? null

    // Se há arquivo novo → faz upload antes de salvar o formulário
    if (pendingFile) {
      try {
        finalAvatarUrl = await uploadAvatar(pendingFile)
        // Remove avatar antigo do disco se era um upload local
        if (site?.bot_avatar_url?.startsWith('/uploads/')) {
          deleteAvatar(site.bot_avatar_url).catch(() => {})
        }
      } catch {
        setUploadError('Falha ao enviar imagem. Tente novamente.')
        return
      }
    }

    onSave({ ...data, bot_avatar_url: finalAvatarUrl } as SiteFormData)
  }

  // URL de preview: arquivo local tem prioridade sobre URL salva
  const previewSrc = pendingPreview ?? avatarUrl ?? null

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

            {/* Avatar do bot */}
            <div className="space-y-1.5">
              <Label>Avatar do bot (opcional)</Label>
              <div className="flex items-center gap-3">
                {/* Preview */}
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border">
                  {previewSrc ? (
                    <img src={previewSrc} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus size={20} className="text-slate-400" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs"
                    >
                      {previewSrc ? 'Trocar imagem' : 'Selecionar imagem'}
                    </Button>
                    {previewSrc && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeAvatar}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        <X size={13} /> Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF · máx. 2 MB</p>
                  {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                </div>
              </div>

              {/* Input file oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Field label="Nome do bot *" error={errors.bot_name?.message}>
              <Input {...register('bot_name')} placeholder="Ex: Ana da Clínica Silva" />
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

            <Field label="Mensagem no WhatsApp ao atingir o limite (opcional)" error={errors.limit_message?.message}>
              <Input
                {...register('limit_message')}
                placeholder="Ex: Olá! Vi seu site e gostaria de mais informações sobre os serviços."
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ao atingir o limite, o widget é substituído automaticamente por um botão de WhatsApp no site.
              </p>
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
