'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { Evaluation } from '@/lib/db'

interface Props {
  evaluations: Evaluation[]
}

const COLORS: Record<string, string> = {
  EXCELENTE: '#10b981',
  BUENO: '#0ea5e9',
  REGULAR: '#f59e0b',
  MALO: '#f43f5e',
}

export function ComparisonChart({ evaluations }: Props) {
  if (evaluations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-slate-600">
            Comparativo de calificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72 flex items-center justify-center text-slate-400 text-sm">
          Aún no hay evaluaciones para comparar.
        </CardContent>
      </Card>
    )
  }

  const data = [...evaluations]
    .map((e) => ({
      name: e.proveedor.length > 22 ? e.proveedor.slice(0, 21) + '…' : e.proveedor,
      fullName: e.proveedor,
      calificacion: Number(e.calificacion.toFixed(1)),
      clasificacion: e.clasificacion,
    }))
    .sort((a, b) => b.calificacion - a.calificacion)

  const avg =
    data.reduce((sum, d) => sum + d.calificacion, 0) / data.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wide text-slate-600 flex items-center justify-between">
          <span>Comparativo de calificaciones ({data.length})</span>
          <span className="text-xs font-normal text-slate-400">
            promedio: <strong className="text-slate-700">{avg.toFixed(1)}</strong>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#334155' }}
                width={150}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v} / 100`, 'Calificación']}
                labelFormatter={(_, payload) =>
                  payload && payload[0] ? String(payload[0].payload.fullName) : ''
                }
              />
              <ReferenceLine x={91} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'EXC', fontSize: 9, fill: '#10b981' }} />
              <ReferenceLine x={71} stroke="#0ea5e9" strokeDasharray="3 3" label={{ value: 'BNO', fontSize: 9, fill: '#0ea5e9' }} />
              <ReferenceLine x={51} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'REG', fontSize: 9, fill: '#f59e0b' }} />
              <ReferenceLine x={avg} stroke="#64748b" strokeDasharray="5 5" label={{ value: 'Prom', fontSize: 9, fill: '#64748b' }} />
              <Bar dataKey="calificacion" radius={[0, 4, 4, 0]}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={COLORS[entry.clasificacion] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px]">
          {Object.entries(COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: v }}
              />
              <span className="text-slate-600 font-medium">{k}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
