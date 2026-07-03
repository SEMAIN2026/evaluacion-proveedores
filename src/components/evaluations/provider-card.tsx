'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CRITERIA, classificationColor, type Evaluation } from '@/lib/evaluations'
import {
  FileText,
  Mail,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  ev: Evaluation
  rank?: number
  total?: number
  avg?: number
  onEdit: (ev: Evaluation) => void
  onDelete: (ev: Evaluation) => void
  onSendEmail: (ev: Evaluation) => void
}

export function ProviderCard({ ev, rank, total, avg, onEdit, onDelete, onSendEmail }: Props) {
  const diff = avg != null ? ev.calificacion - avg : 0
  const hasEmail = !!ev.correo

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow border-slate-200">
      <CardContent className="p-0">
        {/* Header strip */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {rank != null && (
              <div
                className={cn(
                  'shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
                  rank === 1 && 'bg-amber-100 text-amber-700 border border-amber-300',
                  rank === 2 && 'bg-slate-200 text-slate-700 border border-slate-400',
                  rank === 3 && 'bg-orange-100 text-orange-700 border border-orange-300',
                  rank > 3 && 'bg-slate-100 text-slate-600 border border-slate-200'
                )}
              >
                {rank}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 truncate text-base">
                {ev.proveedor}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <Calendar className="w-3 h-3" />
                {formatDate(ev.fecha)}
                {hasEmail ? (
                  <span className="ml-1 truncate max-w-[200px]">· {ev.correo}</span>
                ) : (
                  <span className="ml-1 text-rose-500">· sin correo</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900 leading-none">
                {ev.calificacion.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">/ 100</div>
            </div>
            <Badge
              className={cn(
                'ml-2 px-2 py-1 text-xs font-bold border',
                classificationColor(ev.clasificacion)
              )}
            >
              {ev.clasificacion}
            </Badge>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
          <StatCell label="Puntos" value={`${ev.total}/40`} />
          <StatCell
            label="vs promedio"
            value={
              avg != null
                ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`
                : '—'
            }
            icon={
              diff > 0.5 ? <TrendingUp className="w-3 h-3 text-emerald-600" /> :
              diff < -0.5 ? <TrendingDown className="w-3 h-3 text-rose-600" /> :
              <Minus className="w-3 h-3 text-slate-400" />
            }
          />
          <StatCell label="Posición" value={rank != null && total ? `${rank} de ${total}` : '—'} />
        </div>

        {/* Criteria mini-bars */}
        <div className="px-4 py-3 grid grid-cols-5 gap-1.5">
          {CRITERIA.map((c) => {
            const v = Number((ev as unknown as Record<string, number>)[c.key])
            const colors: Record<number, string> = {
              0: 'bg-slate-100',
              1: 'bg-rose-400',
              2: 'bg-amber-400',
              3: 'bg-sky-400',
              4: 'bg-emerald-500',
            }
            return (
              <div key={c.key} className="text-center" title={`${c.label}: ${v}`}>
                <div className="flex justify-center gap-0.5 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        i <= v ? colors[v] : 'bg-slate-200'
                      )}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-slate-400 font-mono">
                  {v > 0 ? v : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Observations */}
        {ev.observaciones && ev.observaciones.trim() !== '' && (
          <div className="px-4 pb-2">
            <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-2 line-clamp-2">
              <span className="font-semibold text-amber-700">Obs: </span>
              {ev.observaciones}
            </div>
          </div>
        )}

        {/* Actions - 4 main buttons, equally weighted, very clear */}
        <div className="px-3 py-3 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            asChild
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 justify-center"
          >
            <a
              href={`/api/evaluations/${ev.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Ver PDF
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => onSendEmail(ev)}
            disabled={!hasEmail}
            className={cn(
              'justify-center',
              hasEmail
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
            title={hasEmail ? 'Enviar correo con evaluación y gráfica' : 'Sin correo electrónico'}
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Correo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(ev)}
            className="justify-center border-sky-300 text-sky-700 hover:bg-sky-50"
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(ev)}
            className="justify-center text-rose-600 border-rose-300 hover:bg-rose-50"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Borrar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCell({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-1 mt-0.5">
        {icon}
        {value}
      </div>
    </div>
  )
}

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}
