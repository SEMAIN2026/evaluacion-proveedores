'use client'

import { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import type { Evaluation } from '@/lib/db'
import {
  ClipboardList,
  LayoutGrid,
  BarChart3,
  Search,
  Download,
  Mail,
  Plus,
} from 'lucide-react'

export default function Home() {
  const { data, loading, save, remove } = useEvaluations()
  const { stats } = useStats()
  const [editing, setEditing] = useState<Evaluation | null>(null)
  const [emailTarget, setEmailTarget] = useState<Evaluation | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [sort, setSort] = useState<'recent' | 'best' | 'worst' | 'name'>('recent')

  // Ranked data
  const ranked = useMemo(() => {
    const arr = [...data].sort((a, b) => b.calificacion - a.calificacion)
    const map = new Map<string, number>()
    arr.forEach((e, i) => map.set(e.id, i + 1))
    return { arr, map }
  }, [data])

  const filtered = useMemo(() => {
    let arr = [...data]
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
  }, [data, search, classFilter, sort])

  const avg = data.length > 0
    ? data.reduce((s, e) => s + e.calificacion, 0) / data.length
    : 0

  const handleEdit = (ev: Evaluation) => {
    setEditing(ev)
    document.getElementById('evaluacion-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
              <p className="text-[11px] text-slate-500">F-CAL-07 REV01 · Sistema de gestión</p>
            </div>
          </div>
          <div className="flex-1 hidden md:flex items-center justify-end gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/api/export?format=csv" download>
                <Download className="w-4 h-4 mr-1.5" />
                Exportar CSV
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/api/export?format=json" target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-1.5" />
                Ver JSON
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="registro">
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              Registro
            </TabsTrigger>
            <TabsTrigger value="nueva">
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva evaluación
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-1.5" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          {/* REGISTRO */}
          <TabsContent value="registro" className="space-y-4 mt-4">
            {/* Filters */}
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
                  <Button onClick={() => {
                    const tab = document.querySelector('[value="nueva"]') as HTMLButtonElement
                    tab?.click()
                  }}>
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
          </TabsContent>

          {/* NUEVA EVALUACIÓN */}
          <TabsContent value="nueva" className="space-y-4 mt-4" id="evaluacion-form">
            <EvaluationForm
              initial={editing}
              onSave={save}
              onClear={() => setEditing(null)}
            />
          </TabsContent>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <StatsDashboard stats={stats} />
            <ComparisonChart evaluations={data} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            F-CAL-07 REV01 · {data.length} proveedor{data.length === 1 ? '' : 'es'} en registro
          </span>
          <span>
            Diseñado para agilizar la evaluación y comunicación con proveedores
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
