import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { getDashboard, type DashboardStats } from '@/api/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, MessageSquare, Users, Percent, RefreshCw } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PROJECT_COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#94a3b8']
const PROJECT_LABELS: Record<string, string> = {
  site: 'Site', sistema: 'Sistema', hospedagem: 'Hospedagem', outro: 'Outro',
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  async function fetchStats() {
    setLoading(true); setError(null)
    try   { setStats(await getDashboard()) }
    catch (e: any) { setError(e?.response?.data?.error ?? 'Erro ao carregar dashboard.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchStats() }, [])

  const kpis = stats ? [
    { label: 'Sites ativos',        value: stats.total_sites_active,  icon: Building2,     color: 'text-blue-600',  bg: 'bg-blue-50'  },
    { label: 'Sessões (30d)',        value: stats.total_sessions_30d,  icon: MessageSquare, color: 'text-purple-600',bg: 'bg-purple-50'},
    { label: 'Leads (30d)',          value: stats.total_leads_30d,     icon: Users,         color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Taxa de qualificação', value: `${stats.qualification_rate}%`, icon: Percent, color: 'text-amber-600',  bg: 'bg-amber-50' },
  ] : []

  // Preenche 30 dias
  const barData = (() => {
    if (!stats) return []
    const filled: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      filled[d.toISOString().slice(0, 10)] = 0
    }
    stats.leads_by_day.forEach(d => { filled[d.date] = d.count })
    return Object.entries(filled).map(([date, count]) => {
      const [, m, day] = date.split('-')
      return { label: `${day}/${m}`, count }
    })
  })()

  const donutData = stats?.leads_by_project.map((p, i) => ({
    name: PROJECT_LABELS[p.type] ?? p.type,
    value: p.count,
    color: PROJECT_COLORS[i % PROJECT_COLORS.length],
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        )) : kpis.map(kpi => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon size={16} className={kpi.color} />
                </div>
              </div>
              <p className="text-3xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {!loading && stats && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Leads por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Leads" fill="#25D366" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Por tipo de projeto</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                {donutData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top sites */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top sites (últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Domínio</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.top_sites.map(site => (
                    <TableRow key={site.domain}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{site.domain}</TableCell>
                      <TableCell className="text-right">{site.sessions}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="success">{site.leads}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats.top_sites.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados ainda</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
