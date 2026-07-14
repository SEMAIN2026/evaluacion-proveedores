'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Save, RotateCcw, FileText, Trash2, Plus, Search, UserPlus,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Selection {
  id: string
  proveedor: string
  fecha: string
  evaluador: string
  cotizacion_tiempo: string
  inconformidad_tiempo: string
  entrega_tiempo: string
  cantidad_entregada: string
  especificaciones: string
  calidad_precio: string
  requisitos_legales: string
  iso_9001: string
  calificacion: number
  desempeno: string
  observaciones: string
  created_at: number
  updated_at: number
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  proveedor: '',
  fecha: today(),
  evaluador: 'Walter Piñera',
  cotizacion_tiempo: '',
  inconformidad_tiempo: '',
  entrega_tiempo: '',
  cantidad_entregada: '',
  especificaciones: '',
  calidad_precio: '',
  requisitos_legales: '',
  iso_9001: 'NO',
  observaciones: '',
}

// Options configuration
const OPTIONS = {
  cotizacion_tiempo: [
    { val: '1-5', label: 'En un plazo de 1 a 5 días', score: 10 },
    { val: '6-15', label: 'En un plazo de 6 a 15 días', score: 6 },
    { val: '>15', label: 'En un plazo mayor a 15 días', score: 1 },
  ],
  inconformidad_tiempo: [
    { val: '1-3', label: 'En un plazo de 1 a 3 días', score: 10 },
    { val: '4-8', label: 'En un plazo de 4 a 8 días', score: 7 },
    { val: '>8', label: 'En un plazo mayor a 8 días', score: 5 },
    { val: 'no', label: 'No atiende una inconformidad o queja', score: 1 },
  ],
  entrega_tiempo: [
    { val: 'justo', label: 'Justo a tiempo o anticipado', score: 10 },
    { val: '1-7', label: 'Entrega con retraso de 1 a 7 días', score: 7 },
    { val: '8-15', label: 'Entrega con retraso de 8 a 15 días', score: 5 },
    { val: '>15', label: 'Entrega con retraso mayor a 15 días', score: 1 },
  ],
  cantidad_entregada: [
    { val: 'exacta', label: 'Cantidad exacta o mayor debidamente justificada', score: 10 },
    { val: 'faltante_justificado', label: 'Faltante justificado que entrega en 1-3 días', score: 6 },
    { val: 'faltante_injustificado', label: 'Faltante injustificado que no entrega', score: 1 },
  ],
  especificaciones: [
    { val: 'cumple', label: 'Sí cumplen con las especificaciones', score: 10 },
    { val: 'no_cumple', label: 'No cumplen con las especificaciones', score: 1 },
  ],
  calidad_precio: [
    { val: 'mayor_menor', label: 'Mayor calidad y menor precio', score: 10 },
    { val: 'mayor_mayor', label: 'Mayor calidad y mayor precio', score: 7 },
    { val: 'menor_mayor', label: 'Menor calidad y mayor precio', score: 5 },
    { val: 'menor_menor', label: 'Menor calidad y menor precio', score: 1 },
  ],
  requisitos_legales: [
    { val: 'cumple', label: 'Sí cumple con requisitos legales', score: 10 },
    { val: 'no_cumple', label: 'No cumple con requisitos legales', score: 1 },
  ],
}

// Weights
const WEIGHTS = {
  cotizacion: 0.25 * 0.5,
  inconformidad: 0.25 * 0.5,
  entrega: 0.40 * 0.5,
  cantidad: 0.40 * 0.5,
  especificaciones: 0.35 * 0.35,
  calidad_precio: 0.35 * 0.35,
  requisitos_legales: 0.35 * 0.30,
}

function calculateScore(form: Record<string, string>): { score: number; desempeno: string } {
  let total = 0
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const fieldMap: Record<string, keyof typeof OPTIONS> = {
      cotizacion: 'cotizacion_tiempo',
      inconformidad: 'inconformidad_tiempo',
      entrega: 'entrega_tiempo',
      cantidad: 'cantidad_entregada',
      especificaciones: 'especificaciones',
      calidad_precio: 'calidad_precio',
      requisitos_legales: 'requisitos_legales',
    }
    const field = fieldMap[key]
    if (!field) continue
    const val = form[field]
    if (!val) continue
    const opt = OPTIONS[field].find((o) => o.val === val)
    if (opt) {
      total += opt.score * weight
    }
  }

  let desempeno = ''
  if (total >= 9) desempeno = 'DESEMPEÑO NOTABLE'
  else if (total >= 8) desempeno = 'DESEMPEÑO CONFIABLE'
  else if (total >= 7) desempeno = 'DESEMPEÑO RIESGOSO'
  else if (total > 0) desempeno = 'DESEMPEÑO CRÍTICO'

  return { score: Math.round(total * 100) / 100, desempeno }
}

function desempenoColor(d: string): string {
  switch (d) {
    case 'DESEMPEÑO NOTABLE': return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    case 'DESEMPEÑO CONFIABLE': return 'bg-sky-100 text-sky-700 border-sky-300'
    case 'DESEMPEÑO RIESGOSO': return 'bg-amber-100 text-amber-700 border-amber-300'
    case 'DESEMPEÑO CRÍTICO': return 'bg-rose-100 text-rose-700 border-rose-300'
    default: return 'bg-slate-100 text-slate-700 border-slate-300'
  }
}

export function SelectionForm() {
  const [form, setForm] = useState<Record<string, string>>(EMPTY as Record<string, string>)
  const [list, setList] = useState<Selection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Selection | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/selections', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setList(json.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const { score, desempeno } = calculateScore(form)

  const handleSubmit = async () => {
    setError(null)
    if (!form.proveedor.trim()) {
      setError('El nombre del proveedor es obligatorio.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingId || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al guardar' }))
        throw new Error(err.error || 'Error al guardar')
      }
      setForm(EMPTY as Record<string, string>)
      setEditingId(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(EMPTY as Record<string, string>)
    setEditingId(null)
    setError(null)
  }

  const handleEdit = (s: Selection) => {
    setForm({
      proveedor: s.proveedor,
      fecha: s.fecha,
      evaluador: s.evaluador,
      cotizacion_tiempo: s.cotizacion_tiempo,
      inconformidad_tiempo: s.inconformidad_tiempo,
      entrega_tiempo: s.entrega_tiempo,
      cantidad_entregada: s.cantidad_entregada,
      especificaciones: s.especificaciones,
      calidad_precio: s.calidad_precio,
      requisitos_legales: s.requisitos_legales,
      iso_9001: s.iso_9001,
      observaciones: s.observaciones,
    })
    setEditingId(s.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await fetch(`/api/selections?id=${deleteTarget.id}`, { method: 'DELETE' })
      await refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteTarget(null)
    }
  }

  const filteredList = list.filter((s) =>
    !search.trim() || s.proveedor.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              {editingId ? `Editando: ${form.proveedor}` : 'Nuevo formato F-COM-19 — Selección y Aceptación de Proveedor'}
            </CardTitle>
            <Badge variant="outline">F-COM-19 Rev.00</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Supplier info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Nombre o razón social *</Label>
              <Input
                value={form.proveedor}
                onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                placeholder="Ej. SERVIACERO"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Evaluador</Label>
              <Input
                value={form.evaluador}
                onChange={(e) => setForm((f) => ({ ...f, evaluador: e.target.value }))}
              />
            </div>
          </div>

          {/* Criteria sections */}
          <CriteriaSection
            title="CRITERIO 1: Capacidad de Respuesta"
            weight="25%"
            questions={[
              { label: '1.1 ¿En cuánto tiempo entrega una cotización?', field: 'cotizacion_tiempo' as const },
              { label: '1.2 ¿Cuánto tarda en atender una inconformidad?', field: 'inconformidad_tiempo' as const },
            ]}
            form={form}
            setForm={setForm}
          />

          <CriteriaSection
            title="CRITERIO 2: Entrega de Bienes"
            weight="40%"
            questions={[
              { label: '2.1 ¿Tiempo que tarda en entregar un bien/servicio?', field: 'entrega_tiempo' as const },
              { label: '2.2 ¿Entrega la cantidad solicitada?', field: 'cantidad_entregada' as const },
            ]}
            form={form}
            setForm={setForm}
          />

          <CriteriaSection
            title="CRITERIO 3: Cumplimiento de Requisitos"
            weight="35%"
            questions={[
              { label: '3.1 ¿Cumple con especificaciones del cliente?', field: 'especificaciones' as const },
              { label: '3.2 ¿Balance entre calidad y precio?', field: 'calidad_precio' as const },
              { label: '3.3 ¿Cumple requisitos legales?', field: 'requisitos_legales' as const },
            ]}
            form={form}
            setForm={setForm}
          />

          {/* ISO 9001 */}
          <div className="rounded-lg border-2 border-slate-200 p-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">CRITERIO 4: Certificaciones</h4>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">¿Cuenta con certificación ISO 9001?</Label>
              <div className="flex gap-3">
                {['SI', 'NO'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, iso_9001: val }))}
                    className={cn(
                      'px-6 py-2 rounded-md border-2 text-sm font-bold transition-all',
                      form.iso_9001 === val
                        ? val === 'SI'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-rose-500 text-white border-rose-500'
                        : 'border-slate-200 text-slate-500 hover:border-slate-400'
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live result */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Calificación</span>
              <span className="text-4xl font-bold text-emerald-700">{score.toFixed(2)}</span>
              <span className="text-xs text-slate-400">sobre 10</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Desempeño</span>
              <Badge className={cn('px-4 py-2 text-sm font-bold border', desempenoColor(desempeno))}>
                {desempeno || '—'}
              </Badge>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-600">Observaciones</Label>
            <Textarea
              value={form.observaciones}
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              placeholder="Sin observaciones."
              rows={2}
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-between pt-3 border-t">
            <Button variant="ghost" onClick={handleReset} type="button" className="text-slate-600">
              <RotateCcw className="w-4 h-4 mr-2" />
              {editingId ? 'Cancelar edición' : 'Limpiar formulario'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              type="button"
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar evaluación'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List of saved selections */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">
              Formatos guardados ({list.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor…"
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="text-center text-slate-400 py-8 text-sm">Cargando…</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">
              {list.length === 0 ? 'Aún no hay formatos guardados.' : 'Sin resultados.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredList.map((s) => {
                const dColor = desempenoColor(s.desempeno)
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 truncate">{s.proveedor}</span>
                        <Badge variant="outline" className={cn('text-[10px]', dColor)}>
                          {s.desempeno}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatDate(s.fecha)} · {s.evaluador}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-slate-900">{s.calificacion.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">/ 10</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/selections/${s.id}/pdf`} target="_blank" rel="noopener noreferrer">
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(s)}>
                        <Plus className="w-3.5 h-3.5 rotate-45" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteTarget(s)}
                        className="text-rose-600 border-rose-300 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar formato de selección?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el formato de <strong>{deleteTarget?.proveedor}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CriteriaSection({
  title,
  weight,
  questions,
  form,
  setForm,
}: {
  title: string
  weight: string
  questions: { label: string; field: keyof typeof OPTIONS }[]
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  return (
    <div className="rounded-lg border-2 border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-700">{title}</h4>
        <Badge variant="outline" className="text-[10px] bg-slate-100">Peso: {weight}</Badge>
      </div>
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi}>
            <Label className="text-xs text-slate-600 mb-2 block">{q.label}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {OPTIONS[q.field].map((opt) => {
                const isSelected = form[q.field] === opt.val
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, [q.field]: opt.val }))}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2 rounded-md border-2 text-xs transition-all text-left',
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex items-center gap-2 flex-1">
                      <span className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                      )}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      {opt.label}
                    </span>
                    <span className={cn(
                      'text-xs font-bold shrink-0',
                      isSelected ? 'text-emerald-600' : 'text-slate-400'
                    )}>
                      {opt.score}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
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
