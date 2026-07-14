'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useEvaluations, useStats } from '@/components/evaluations/use-evaluations'
import { EvaluationForm } from '@/components/evaluations/evaluation-form'
import { ProviderCard } from '@/components/evaluations/provider-card'
import { EmailModal } from '@/components/evaluations/email-modal'
import { StatsDashboard } from '@/components/evaluations/stats-dashboard'
import { ComparisonChart } from '@/components/evaluations/comparison-chart'
import type { Evaluation } from '@/lib/evaluations'
import {
  ClipboardList,
  Search,
  Download,
  Mail,
  Plus,
  Pencil,
  BarChart3,
  LayoutGrid,
  Eye,
  EyeOff,
  LogOut,
  Calendar,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type View = 'list' | 'new' | 'dashboard'

export default function Home() {
  const { data, loading, save, remove } = useEvaluations()
  const { stats } = useStats()
  const [view, setView] = useState<View>('list')
  const [editing, setEditing] = useState<Evaluation | null>(null)
  const [emailTarget, setEmailTarget] = useState<Evaluation | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [sort, setSort] = useState<'recent' | 'best' | 'worst' | 'name'>('recent')
  const [showDashboard, setShowDashboard] = useState(false)
  const [monthFilter, setMonthFilter] = useState<string>('ALL') // 'ALL' or 'YYYY-MM'
  const formRef = useRef<HTMLDivElement>(null)

  // Available months derived from data (YYYY-MM → label)
  const availableMonths = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>()
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    for (const ev of data) {
      const d = new Date(ev.fecha)
      if (isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
      const existing = map.get(key)
      if (existing) existing.count++
      else map.set(key, { label, count: 1 })
    }
    // Sort by key descending (most recent first)
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val]) => ({ key, ...val }))
  }, [data])

  // Ranked data
  const ranked = useMemo(() => {
    const arr = [...data].sort((a, b) => b.calificacion - a.calificacion)
    const map = new Map<string, number>()
    arr.forEach((e, i) => map.set(e.id, i + 1))
    return { arr, map }
  }, [data])

  const filtered = useMemo(() => {
    let arr = [...data]
    // Month/year filter
    if (monthFilter !== 'ALL') {
      const [y, m] = monthFilter.split('-').map(Number)
      arr = arr.filter((e) => {
        const d = new Date(e.fecha)
        return d.getFullYear() === y && (d.getMonth() + 1) === m
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(
        (e) =>
          e.proveedor.toLowerCase().includes(q) ||
          (e.correo || '').toLowerCase().includes(q) ||
          (e.observaciones || '').toLowerCase().includes(q)
      )
    }
    if (classFilter !== 'ALL') {
      arr = arr.filter((e) => e.clasificacion === classFilter)
    }
    switch (sort) {
      case 'best':
        arr.sort((a, b) => b.calificacion - a.calificacion)
        break
      case 'worst':
        arr.sort((a, b) => a.calificacion - b.calificacion)
        break
      case 'name':
        arr.sort((a, b) => a.proveedor.localeCompare(b.proveedor))
        break
      case 'recent':
      default:
        arr.sort((a, b) => {
          const da = new Date(a.fecha).getTime()
          const db = new Date(b.fecha).getTime()
          if (da !== db) return db - da
          return b.created_at - a.created_at
        })
    }
    return arr
  }, [data, search, classFilter, sort, monthFilter])

  const avg = data.length > 0
    ? data.reduce((s, e) => s + e.calificacion, 0) / data.length
    : 0

  // ---- Actions ----
  const handleNew = () => {
    setEditing(null)
    setView('new')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const handleEdit = (ev: Evaluation) => {
    setEditing(ev)
    setView('new')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const handleSendEmail = (ev: Evaluation) => {
    setEmailTarget(ev)
    setEmailOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleFormSave = async (payload: Partial<Evaluation> & { proveedor: string }) => {
    const saved = await save(payload)
    setEditing(null)
    setView('list')
    return saved
  }

  const handleFormClear = () => {
    setEditing(null)
    setView('list')
  }

  // Auto-switch back to list after editing a non-existent record
  useEffect(() => {
    if (editing && !data.find((e) => e.id === editing.id)) {
      // editing record no longer exists, ignore
    }
  }, [data, editing])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-900">
                Evaluación de Proveedores
              </h1>
              <p className="text-[11px] text-slate-500">F-CAL-07 REV01 · {data.length} proveedor{data.length === 1 ? '' : 'es'}</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDashboard((v) => !v)}
              className={cn(showDashboard && 'bg-slate-100')}
            >
              {showDashboard ? <EyeOff className="w-4 h-4 mr-1.5" /> : <BarChart3 className="w-4 h-4 mr-1.5" />}
              {showDashboard ? 'Ocultar panel' : 'Ver panel'}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/api/export?format=csv" download>
                <Download className="w-4 h-4 mr-1.5" />
                Excel
              </a>
            </Button>
            <Button
              size="sm"
              onClick={handleNew}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva evaluación
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Optional dashboard */}
        {showDashboard && (
          <div className="space-y-4">
            <StatsDashboard stats={stats} />
            <ComparisonChart evaluations={data} />
            <div className="border-t border-slate-200 pt-2" />
          </div>
        )}

        {/* Form (shown when view === 'new') */}
        {view === 'new' && (
          <div ref={formRef} className="scroll-mt-20">
            <EvaluationForm
              initial={editing}
              onSave={handleFormSave}
              onClear={handleFormClear}
            />
          </div>
        )}

        {/* Always-visible list */}
        {view === 'list' && (
          <>
            {/* Month selector — prominent, full width */}
            <div className="bg-gradient-to-r from-emerald-50 to-slate-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 shrink-0">Período:</span>
                <div className="flex-1 min-w-[200px] max-w-md">
                  <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Todos los meses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los meses ({data.length})</SelectItem>
                      {availableMonths.map((m) => (
                        <SelectItem key={m.key} value={m.key}>
                          {m.label} ({m.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {monthFilter !== 'ALL' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMonthFilter('ALL')}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Quitar filtro
                  </Button>
                )}
              </div>
            </div>

            {/* Search & filters */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white border border-slate-200 rounded-lg p-3">
              <div className="md:col-span-5 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por proveedor, correo u observaciones…"
                  className="pl-9"
                />
              </div>
              <div className="md:col-span-3">
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las clasificaciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las clasificaciones</SelectItem>
                    <SelectItem value="EXCELENTE">EXCELENTE</SelectItem>
                    <SelectItem value="BUENO">BUENO</SelectItem>
                    <SelectItem value="REGULAR">REGULAR</SelectItem>
                    <SelectItem value="MALO">MALO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Más recientes primero</SelectItem>
                    <SelectItem value="best">Mejor calificación primero</SelectItem>
                    <SelectItem value="worst">Peor calificación primero</SelectItem>
                    <SelectItem value="name">Orden alfabético</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1 text-right text-sm text-slate-500">
                {filtered.length} / {data.length}
              </div>
            </div>

            {/* Provider cards grid */}
            {loading ? (
              <div className="text-center text-slate-400 py-20 text-sm">
                Cargando evaluaciones…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
                <Mail className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-semibold text-slate-700 mb-1">
                  {data.length === 0 ? 'Aún no hay evaluaciones' : 'Sin resultados'}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  {data.length === 0
                    ? 'Empieza creando tu primera evaluación de proveedor.'
                    : 'Prueba con otros filtros de búsqueda.'}
                </p>
                {data.length === 0 && (
                  <Button onClick={handleNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva evaluación
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((ev) => (
                  <ProviderCard
                    key={ev.id}
                    ev={ev}
                    rank={ranked.map.get(ev.id)}
                    total={data.length}
                    avg={avg}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                    onSendEmail={handleSendEmail}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>F-CAL-07 REV01 · Sistema de Evaluación de Proveedores</span>
          <span>
            <LayoutGrid className="w-3 h-3 inline mr-1" />
            {data.length} proveedor{data.length === 1 ? '' : 'es'} ·{' '}
            <Pencil className="w-3 h-3 inline mx-1" />
            Edita con el botón lápiz ·{' '}
            <Mail className="w-3 h-3 inline mx-1" />
            Envía correo proveedor por proveedor
          </span>
        </div>
      </footer>

      {/* Email modal */}
      <EmailModal
        ev={emailTarget}
        open={emailOpen}
        onOpenChange={setEmailOpen}
        evaluador={editing?.evaluador || 'Walter Piñera'}
        cargo={editing?.cargo || 'Ingeniero Calidad y Compras'}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evaluación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la evaluación de{' '}
              <strong>{deleteTarget?.proveedor}</strong>. Esta acción no se puede
              deshacer.
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
