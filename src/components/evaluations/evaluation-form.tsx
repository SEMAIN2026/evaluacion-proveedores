'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CRITERIA, classify, type Evaluation } from '@/lib/db'
import { Save, RotateCcw, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  initial?: Evaluation | null
  onSave: (payload: Partial<Evaluation> & { proveedor: string }) => Promise<Evaluation>
  onClear?: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  proveedor: '',
  correo: '',
  fecha: today(),
  c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
  c6: 0, c7: 0, c8: 0, c9: 0, c10: 0,
  observaciones: '',
  evaluador: 'Walter Piñera',
  cargo: 'Ingeniero Calidad y Compras',
}

export function EvaluationForm({ initial, onSave, onClear }: Props) {
  const [form, setForm] = useState<Record<string, string | number>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initial) {
      setForm({
        proveedor: initial.proveedor,
        correo: initial.correo || '',
        fecha: initial.fecha,
        c1: initial.c1, c2: initial.c2, c3: initial.c3, c4: initial.c4, c5: initial.c5,
        c6: initial.c6, c7: initial.c7, c8: initial.c8, c9: initial.c9, c10: initial.c10,
        observaciones: initial.observaciones,
        evaluador: initial.evaluador,
        cargo: initial.cargo,
        id: initial.id,
      })
    } else {
      setForm(EMPTY)
    }
  }, [initial])

  const scores = CRITERIA.map((c) => Number(form[c.key] || 0))
  const total = scores.reduce((a, b) => a + b, 0)
  const pct = (total / 40) * 100
  const cls = classify(pct)

  const handleScore = (key: string, val: number) => {
    setForm((f) => ({ ...f, [key]: val }))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!String(form.proveedor || '').trim()) {
      setError('El nombre del proveedor es obligatorio.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        id: form.id ? String(form.id) : undefined,
        proveedor: String(form.proveedor).trim(),
        correo: form.correo ? String(form.correo).trim() : '',
        fecha: String(form.fecha),
        c1: Number(form.c1), c2: Number(form.c2), c3: Number(form.c3),
        c4: Number(form.c4), c5: Number(form.c5), c6: Number(form.c6),
        c7: Number(form.c7), c8: Number(form.c8), c9: Number(form.c9),
        c10: Number(form.c10),
        observaciones: String(form.observaciones || ''),
        evaluador: String(form.evaluador || 'Walter Piñera'),
        cargo: String(form.cargo || 'Ingeniero Calidad y Compras'),
      })
      if (!initial) {
        setForm(EMPTY)
      }
      onClear?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(EMPTY)
    setError(null)
    onClear?.()
  }

  return (
    <Card className="w-full">
      <CardHeader className="bg-slate-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {initial ? `Editando: ${initial.proveedor}` : 'Nueva evaluación de proveedor'}
          </CardTitle>
          {initial && (
            <Badge variant="outline">F-CAL-07 REV01 · Editando</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Supplier info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="proveedor" className="text-xs uppercase tracking-wide text-slate-600">
              Nombre del proveedor *
            </Label>
            <Input
              id="proveedor"
              value={String(form.proveedor)}
              onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
              placeholder="Ej. CNC Herramientas Chihuahua"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="correo" className="text-xs uppercase tracking-wide text-slate-600">
              Correo electrónico
            </Label>
            <Input
              id="correo"
              type="email"
              value={String(form.correo)}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
              placeholder="ventas@proveedor.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha" className="text-xs uppercase tracking-wide text-slate-600">
              Fecha de evaluación
            </Label>
            <Input
              id="fecha"
              type="date"
              value={String(form.fecha).slice(0, 10)}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
        </div>

        {/* Scoring instructions */}
        <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 flex flex-wrap gap-x-6 gap-y-2 items-center text-sm">
          <span className="font-semibold text-slate-700">Sistema de puntuación:</span>
          <ScoreChip color="bg-rose-500" label="Malo = 1" />
          <ScoreChip color="bg-amber-500" label="Regular = 2" />
          <ScoreChip color="bg-sky-500" label="Bien = 3" />
          <ScoreChip color="bg-emerald-500" label="Excelente = 4" />
        </div>

        {/* Criteria */}
        <div className="space-y-3">
          {CRITERIA.map((c, idx) => (
            <div
              key={c.key}
              className={cn(
                'grid grid-cols-12 gap-3 items-center py-2 px-3 rounded-md',
                idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'
              )}
            >
              <div className="col-span-12 md:col-span-7 flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-6 text-right">{idx + 1}</span>
                <span className="text-sm font-medium text-slate-800">{c.label}</span>
              </div>
              <div className="col-span-12 md:col-span-5 flex items-center gap-2">
                <div className="flex gap-1.5 flex-1">
                  {[1, 2, 3, 4].map((v) => {
                    const active = Number(form[c.key]) === v
                    const colors: Record<number, string> = {
                      1: active ? 'bg-rose-500 text-white border-rose-500' : 'hover:border-rose-400 hover:text-rose-600 text-slate-500',
                      2: active ? 'bg-amber-500 text-white border-amber-500' : 'hover:border-amber-400 hover:text-amber-600 text-slate-500',
                      3: active ? 'bg-sky-500 text-white border-sky-500' : 'hover:border-sky-400 hover:text-sky-600 text-slate-500',
                      4: active ? 'bg-emerald-500 text-white border-emerald-500' : 'hover:border-emerald-400 hover:text-emerald-600 text-slate-500',
                    }
                    const labels: Record<number, string> = { 1: 'M', 2: 'R', 3: 'B', 4: 'E' }
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleScore(c.key, v)}
                        className={cn(
                          'flex-1 h-10 rounded-md border-2 text-sm font-bold transition-all flex flex-col items-center justify-center',
                          colors[v]
                        )}
                        title={['Malo', 'Regular', 'Bien', 'Excelente'][v - 1]}
                      >
                        <span className="text-base leading-none">{v}</span>
                        <span className="text-[9px] leading-none mt-0.5">{labels[v]}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="text-xs text-slate-500 w-16 text-right">
                  {Number(form[c.key]) > 0
                    ? ['Malo', 'Regular', 'Bien', 'Excelente'][Number(form[c.key]) - 1]
                    : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live result */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <ResultTile label="Puntos obtenidos" value={`${total}`} sub="de 40" />
          <ResultTile label="Puntos posibles" value="40" sub="máximo" />
          <ResultTile label="Evaluación" value={`${pct.toFixed(1)}%`} sub="calificación" />
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Clasificación</span>
            <Badge
              className={cn(
                'px-3 py-1 text-sm font-bold',
                cls === 'EXCELENTE' && 'bg-emerald-100 text-emerald-700 border border-emerald-300',
                cls === 'BUENO' && 'bg-sky-100 text-sky-700 border border-sky-300',
                cls === 'REGULAR' && 'bg-amber-100 text-amber-700 border border-amber-300',
                cls === 'MALO' && 'bg-rose-100 text-rose-700 border border-rose-300'
              )}
            >
              <Star className="w-3.5 h-3.5 mr-1" />
              {cls}
            </Badge>
          </div>
        </div>

        {/* Observations */}
        <div className="space-y-2">
          <Label htmlFor="obs" className="text-xs uppercase tracking-wide text-slate-600">
            Observaciones
          </Label>
          <Textarea
            id="obs"
            value={String(form.observaciones)}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
            placeholder="Sin observaciones."
            rows={3}
          />
        </div>

        {/* Evaluator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="evaluador" className="text-xs uppercase tracking-wide text-slate-600">
              Nombre del evaluador
            </Label>
            <Input
              id="evaluador"
              value={String(form.evaluador)}
              onChange={(e) => setForm((f) => ({ ...f, evaluador: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo" className="text-xs uppercase tracking-wide text-slate-600">
              Cargo
            </Label>
            <Input
              id="cargo"
              value={String(form.cargo)}
              onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end pt-2 border-t">
          <Button variant="outline" onClick={handleReset} type="button">
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} type="button">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando…' : initial ? 'Actualizar evaluación' : 'Guardar evaluación'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span className={cn('w-3 h-3 rounded-sm', color)} />
      {label}
    </span>
  )
}

function ResultTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <span className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <span className="text-2xl font-bold text-slate-900 leading-none">{value}</span>
      <span className="text-[10px] text-slate-400 mt-1">{sub}</span>
    </div>
  )
}
