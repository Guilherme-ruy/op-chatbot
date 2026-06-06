import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, EyeOff, Save, Send, CheckCircle2, XCircle, Mail, ServerIcon } from 'lucide-react'
import { getSmtpSettings, saveSmtpSettings, testSmtpConnection } from '@/api/smtp'
import { formatDateTime } from '@/lib/utils'
import type { SmtpSettingsPublic, SmtpSettingsInput } from '@/types/admin'

// ── Estado inicial do formulário ──────────────────────────────────────────────

const EMPTY_FORM = {
  host:               '',
  port:               '',
  user_email:         '',
  pass:               '',
  from_address:       '',
  notification_email: '',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function SmtpPage() {
  const [settings,   setSettings]   = useState<SmtpSettingsPublic | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showPass,   setShowPass]   = useState(false)

  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => { loadSettings() }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function loadSettings() {
    setLoading(true)
    try {
      const data = await getSmtpSettings()
      setSettings(data)
      if (data) {
        setForm({
          host:               data.host,
          port:               String(data.port),
          user_email:         data.user_email,
          pass:               '',    // senha nunca é pré-preenchida
          from_address:       data.from_address,
          notification_email: data.notification_email,
        })
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao carregar configurações.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false); setTestResult(null)
    try {
      const payload: SmtpSettingsInput = {
        host:               form.host.trim(),
        port:               parseInt(form.port) || 587,
        user_email:         form.user_email.trim(),
        from_address:       form.from_address.trim(),
        notification_email: form.notification_email.trim(),
        ...(form.pass ? { pass: form.pass } : {}),
      }
      const updated = await saveSmtpSettings(payload)
      setSettings(updated)
      setForm(f => ({ ...f, pass: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      await testSmtpConnection()
      setTestResult({ ok: true, message: `Teste enviado para ${settings?.notification_email}.` })
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.response?.data?.error ?? 'Falha ao enviar e-mail de teste.' })
    } finally {
      setTesting(false)
    }
  }

  function field(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setTestResult(null)
  }

  const isConfigured = !!(settings?.pass_configured && settings?.user_email)

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">E-mail / SMTP</h1>
        <p className="text-sm text-muted-foreground">
          Servidor usado para envio de notificações de leads qualificados
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Layout principal: form (2/3) + sidebar (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Formulário ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 rounded-xl border bg-white shadow-sm divide-y">

          {/* Seção: Conexão */}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ServerIcon size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Conexão
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="host">Servidor (host)</Label>
                <Input
                  id="host"
                  value={form.host}
                  onChange={e => field('host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={e => field('port', e.target.value)}
                  placeholder="587"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user_email">Usuário (e-mail de login)</Label>
              <Input
                id="user_email"
                type="email"
                value={form.user_email}
                onChange={e => field('user_email', e.target.value)}
                placeholder="seu@gmail.com"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pass">Senha</Label>
                {settings?.pass_configured && (
                  <span className="text-xs text-muted-foreground">
                    Deixe em branco para manter a atual
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="pass"
                  type={showPass ? 'text' : 'password'}
                  value={form.pass}
                  onChange={e => field('pass', e.target.value)}
                  placeholder={settings?.pass_configured ? '••••••••' : 'Digite a senha'}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Seção: E-mail */}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                E-mail
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="from_address">Remetente</Label>
              <Input
                id="from_address"
                value={form.from_address}
                onChange={e => field('from_address', e.target.value)}
                placeholder='Chatbot <noreply@seudominio.com.br>'
              />
              <p className="text-xs text-muted-foreground">
                Nome e endereço exibidos no campo "De" dos e-mails.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notification_email">E-mail de notificação</Label>
              <Input
                id="notification_email"
                type="email"
                value={form.notification_email}
                onChange={e => field('notification_email', e.target.value)}
                placeholder="contato@suaagencia.com.br"
              />
              <p className="text-xs text-muted-foreground">
                Destinatário das notificações de leads qualificados.
              </p>
            </div>
          </div>
        </div>

        {/* ── Sidebar direita ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status */}
          <div className="rounded-xl border bg-white shadow-sm p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Status
            </p>
            <div className="flex items-center gap-2.5">
              {isConfigured
                ? <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                : <XCircle    size={18} className="text-slate-400 flex-shrink-0" />}
              <div>
                <p className="text-sm font-semibold">
                  {isConfigured ? 'Configurado' : 'Não configurado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isConfigured
                    ? `Usuário: ${settings?.user_email}`
                    : 'Preencha os campos e salve'}
                </p>
              </div>
            </div>
            {settings?.updated_at && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                Atualizado em {formatDateTime(settings.updated_at)}
              </p>
            )}
          </div>

          {/* Ações */}
          <div className="rounded-xl border bg-white shadow-sm p-5 space-y-2.5">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </Button>

            {isConfigured && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing}
                className="w-full"
              >
                <Send size={14} />
                {testing ? 'Enviando...' : 'Testar envio'}
              </Button>
            )}
          </div>

          {/* Feedback: salvo */}
          {saved && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Configurações salvas com sucesso.</AlertDescription>
            </Alert>
          )}

          {/* Feedback: resultado do teste */}
          {testResult && (
            <Alert variant={testResult.ok ? 'default' : 'destructive'}>
              {testResult.ok
                ? <CheckCircle2 className="h-4 w-4" />
                : <XCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Dica (apenas quando não configurado) */}
          {!isConfigured && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-xs text-blue-800 space-y-1.5">
              <p className="font-semibold">Provedores compatíveis</p>
              <p className="text-blue-700 leading-relaxed">
                Gmail, Outlook / Office 365, Sendgrid, Resend, Amazon SES e qualquer
                servidor SMTP padrão.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
