'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, TrendingUp, Mail, MailX, Trophy, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Stats {
  total: number
  average: number
  max: number
  min: number
  distribution: Record<string, { count: number; avg: number }>
  top5: Array<{ id: string; proveedor: string; calificacion: number; clasificacion: string; fecha: string }>
  bottom5: Array<{ id: string; proveedor: string; calificacion: number; clasificacion: string; fecha: string }>
  withEmail: number
  withoutEmail: number
}

export function StatsDashboard({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    )
  }

  const cls = classify(stats.average)

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Proveedores"
          value={`${stats.total}`}
          sub="evaluados"
          color="text-slate-700 bg-slate-100"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Promedio general"
          value={stats.average.toFixed(1)}
          sub={`/ 100 · ${cls}`}
          color={clsColor(cls)}
        />
        <KpiCard
          icon={<Mail className="w-5 h-5" />}
          label="Con correo"
          value={`${stats.withEmail}`}
          sub="pueden recibir reporte"
          color="text-emerald-700 bg-emerald-100"
        />
        <KpiCard
          icon={<MailX className="w-5 h-5" />}
          label="Sin correo"
          value={`${stats.withoutEmail}`}
          sub="faltan capturar"
          color="text-rose-700 bg-rose-100"
        />
      </div>

      {/* Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wide text-slate-600">
            Distribución por clasificación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {['EXCELENTE', 'BUENO', 'REGULAR', 'MALO'].map((c) => {
            const d = stats.distribution[c] || { count: 0, avg: 0 }
            const pct = stats.total > 0 ? (d.count / stats.total) * 100 : 0
            const barColor =
              c === 'EXCELENTE' ? 'bg-emerald-500' :
              c === 'BUENO' ? 'bg-sky-500' :
              c === 'REGULAR' ? 'bg-amber-500' :
              'bg-rose-500'
            return (
              <div key={c} className="flex items-center gap-3">
                <div className="w-24 flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-sm', barColor)} />
                  <span className="text-sm font-medium text-slate-700">{c}</span>
                </div>
                <div className="flex-1">
                  <Progress value={pct} className="h-3" />
                </div>
                <div className="w-20 text-right text-sm font-semibold text-slate-700">
                  {d.count}
                </div>
                <div className="w-16 text-right text-xs text-slate-400">
                  {d.count > 0 ? `${d.avg.toFixed(1)}` : '—'}
                </div>
              </div>
            )
          })}
          <div className="flex justify-end gap-6 text-[10px] uppercase tracking-wide text-slate-400 pt-1 border-t">
            <span>cantidad</span>
            <span>promedio</span>
          </div>
        </CardContent>
      </Card>

      {/* Top & Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RankingCard
          title="Top 5 proveedores"
          icon={<Trophy className="w-4 h-4 text-amber-600" />}
          rows={stats.top5}
          variant="top"
        />
        <RankingCard
          title="Requieren atención"
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
          rows={stats.bottom5}
          variant="bottom"
        />
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center shrink-0', color)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
          <div className="text-[11px] text-slate-500 truncate">{sub}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function RankingCard({
  title,
  icon,
  rows,
  variant,
}: {
  title: string
  icon: React.ReactNode
  rows: Array<{ id: string; proveedor: string; calificacion: number; clasificacion: string; fecha: string }>
  variant: 'top' | 'bottom'
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 && (
          <div className="text-sm text-slate-400 italic py-4 text-center">
            Sin datos todavía.
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50"
          >
            <span
              className={cn(
                'w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0',
                variant === 'top'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
              )}
            >
              {i + 1}
            </span>
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">
              {r.proveedor}
            </span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {r.calificacion.toFixed(1)}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0',
                r.clasificacion === 'EXCELENTE' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                r.clasificacion === 'BUENO' && 'bg-sky-50 text-sky-700 border-sky-200',
                r.clasificacion === 'REGULAR' && 'bg-amber-50 text-amber-700 border-amber-200',
                r.clasificacion === 'MALO' && 'bg-rose-50 text-rose-700 border-rose-200'
              )}
            >
              {r.clasificacion}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function classify(score: number): string {
  if (score >= 91) return 'EXCELENTE'
  if (score >= 71) return 'BUENO'
  if (score >= 51) return 'REGULAR'
  return 'MALO'
}

function clsColor(c: string): string {
  switch (c) {
    case 'EXCELENTE': return 'text-emerald-700 bg-emerald-100'
    case 'BUENO': return 'text-sky-700 bg-sky-100'
    case 'REGULAR': return 'text-amber-700 bg-amber-100'
    case 'MALO': return 'text-rose-700 bg-rose-100'
    default: return 'text-slate-700 bg-slate-100'
  }
}
