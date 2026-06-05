import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getSiteStats } from '@/api/sites'
import type { SiteDetailStats } from '@/types/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, RefreshCw, Users, TrendingUp, MessageSquare, AlertTriangle, Infinity, Copy, Check, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const PROJECT_LABELS: Record<string, string> = { site: 'Site', sistema: 'Sistema', hospedagem: 'Hospedagem', outro: 'Outro' }

export default function SiteDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [stats,   setStats]   = useState<SiteDetailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)

  async function fetchStats() {
    if (!id) return
    setLoading(true); setError(null)
    try   { setStats(await getSiteStats(id)) }
    catch (e: any) { setError(e?.response?.data?.error ?? 'Erro ao carregar dados do site.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchStats() }, [id])

  const usagePercent = useMemo(() => {
    if (!stats?.site.monthly_session_limit) return 0
    return Math.min(100, Math.round((stats.sessions_this_month / stats.site.monthly_session_limit) * 100))
  }, [stats])

  const usageColor = usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 75 ? 'bg-amber-500' : 'bg-green-500'

  const renewalDate = (() => {
    const now = new Date(); const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toLocaleDateString('pt-BR')
  })()

  const barData = useMemo(() => {
    if (!stats) return []
    const filled: Record<string, { sessions: number; leads: number }> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      filled[d.toISOString().slice(0, 10)] = { sessions: 0, leads: 0 }
    }
    stats.sessions_by_day.forEach(d => { filled[d.date] = { sessions: d.sessions, leads: d.leads } })
    return Object.entries(filled).map(([date, v]) => {
      const [, m, day] = date.split('-')
      return { label: `${day}/${m}`, ...v }
    })
  }, [stats])

  const peakData = useMemo(() => {
    if (!stats) return []
    const map = Object.fromEntries(stats.peak_hours.map(h => [h.hour, h.count]))
    return Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}h`, count: map[h] ?? 0 }))
  }, [stats])

  const snippet = stats ? `<script src="${window.location.origin}/widget.js" data-token="${stats.site.token}" defer></script>` : ''

  function copySnippet() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{stats?.site.name ?? 'Carregando...'}</h1>
          <p className="text-sm text-muted-foreground">{stats?.site.domain}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : stats && (
        <>
          {/* Uso mensal */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <p className="font-semibold">Uso mensal</p>
                  <p className="text-sm text-muted-foreground">
                    Renova em {renewalDate}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold">{stats.sessions_this_month}</span>
                  <span className="text-muted-foreground ml-1">/ {stats.site.monthly_session_limit ?? '∞'} conversas</span>
                </div>
              </div>
              {stats.site.monthly_session_limit ? (
                <>
                  <Progress value={usagePercent} className="h-3" indicatorClassName={usageColor} />
                  <p className="text-xs text-muted-foreground mt-2">{usagePercent}% utilizado</p>
                  {usagePercent >= 75 && (
                    <Alert variant={usagePercent >= 90 ? 'destructive' : 'warning'} className="mt-3">
                      <AlertTriangle size={14} />
                      <AlertDescription>
                        {usagePercent >= 90
                          ? `⚠️ Limite quase esgotado (${usagePercent}%). Considere aumentar o plano.`
                          : `Atenção: ${usagePercent}% do limite mensal utilizado.`}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <Infinity size={14} /> Plano ilimitado
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPIs do mês */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Leads este mês',        value: stats.leads_this_month,          icon: Users,          color: 'text-green-600',  bg: 'bg-green-50'  },
              { label: 'Taxa de qualificação',  value: `${stats.qualification_rate}%`,  icon: TrendingUp,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
              { label: 'Média msgs/conversa',   value: stats.avg_messages_per_session,  icon: MessageSquare,  color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Taxa de abandono',      value: `${stats.abandonment_rate}%`,    icon: AlertTriangle,  color: 'text-amber-600',  bg: 'bg-amber-50'  },
            ].map(kpi => (
              <Card key={kpi.label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <div className={`p-1.5 rounded-lg ${kpi.bg}`}><kpi.icon size={13} className={kpi.color} /></div>
                  </div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Totais históricos */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50"><MessageSquare size={20} className="text-blue-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de conversas (histórico)</p>
                  <p className="text-2xl font-bold">{stats.total_sessions_all}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-50"><Users size={20} className="text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de leads (histórico)</p>
                  <p className="text-2xl font-bold">{stats.total_leads_all}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Atividade */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Atividade — últimos 30 dias</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sessions" name="Sessões" fill="#25D36655" stroke="#25D366" strokeWidth={1} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="leads"    name="Leads"   fill="#128C7Eaa" stroke="#128C7E" strokeWidth={1} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tipos de projeto + Horários de pico */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tipos de projeto</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {stats.leads_by_project.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum lead ainda.</p>
                ) : stats.leads_by_project.map(p => (
                  <div key={p.type} className="flex items-center gap-3">
                    <span className="text-sm w-24 flex-shrink-0">{PROJECT_LABELS[p.type] ?? p.type}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${stats.leads_this_month > 0 ? (p.count / stats.leads_this_month) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-6 text-right">{p.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Horários de pico</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={peakData} margin={{ left: -25, right: 0, top: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={3} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Conversas" fill="#34B7F155" stroke="#34B7F1" strokeWidth={1} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Últimos leads */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Últimos leads</CardTitle></CardHeader>
            <CardContent className="p-0">
              {stats.recent_leads.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted-foreground">Nenhum lead gerado ainda.</p>
              ) : stats.recent_leads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between px-6 py-3 border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-sm font-medium">{lead.name ?? '—'}</span>
                    {lead.project_type && <Badge variant="secondary" className="ml-2 text-xs">{PROJECT_LABELS[lead.project_type] ?? lead.project_type}</Badge>}
                    <div className="text-xs text-muted-foreground mt-0.5">{lead.contact ?? '—'} · {formatDate(lead.created_at)}</div>
                  </div>
                  {lead.whatsapp_url && (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-green-600">
                      <a href={lead.whatsapp_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Snippet */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Código de instalação</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Cole antes do fechamento de <code className="text-xs bg-slate-100 px-1 rounded">&lt;/body&gt;</code> no site do cliente:</p>
              <div className="flex items-start gap-3 bg-slate-900 rounded-lg p-4">
                <code className="text-xs text-green-400 flex-1 break-all font-mono leading-relaxed">{snippet}</code>
                <Button variant="ghost" size="icon" onClick={copySnippet} className="text-slate-400 hover:text-white flex-shrink-0 h-7 w-7">
                  {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
