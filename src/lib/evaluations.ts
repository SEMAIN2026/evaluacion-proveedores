// Pure types, constants, and helper functions for evaluations.
// This file is safe to import from client components (no Node-only deps).

export interface Evaluation {
  id: string
  proveedor: string
  correo: string | null
  fecha: string
  c1: number
  c2: number
  c3: number
  c4: number
  c5: number
  c6: number
  c7: number
  c8: number
  c9: number
  c10: number
  total: number
  calificacion: number
  clasificacion: string
  observaciones: string
  evaluador: string
  cargo: string
  created_at: number
  updated_at: number
}

// 10 evaluation criteria (Spanish, matching the original Excel template F-CAL-07 REV01)
export const CRITERIA: { key: keyof Evaluation; label: string }[] = [
  { key: 'c1', label: 'Calidad del producto' },
  { key: 'c2', label: 'Relación precio-calidad' },
  { key: 'c3', label: 'Material en stock' },
  { key: 'c4', label: 'Posibilidad de devolución del producto' },
  { key: 'c5', label: 'Servicio (velocidad de respuesta)' },
  { key: 'c6', label: 'Cumplimiento de fecha de entrega' },
  { key: 'c7', label: 'Servicio post-venta' },
  { key: 'c8', label: 'Pago del transporte' },
  { key: 'c9', label: 'Amabilidad de venta' },
  { key: 'c10', label: 'Envío de material completo' },
]

export const SCORE_LABELS: Record<number, string> = {
  1: 'Malo',
  2: 'Regular',
  3: 'Bien',
  4: 'Excelente',
}

export function classify(score: number): string {
  if (score >= 91) return 'EXCELENTE'
  if (score >= 71) return 'BUENO'
  if (score >= 51) return 'REGULAR'
  return 'MALO'
}

export function classificationColor(clasificacion: string): string {
  switch (clasificacion) {
    case 'EXCELENTE': return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    case 'BUENO': return 'bg-sky-100 text-sky-700 border-sky-300'
    case 'REGULAR': return 'bg-amber-100 text-amber-700 border-amber-300'
    case 'MALO': return 'bg-rose-100 text-rose-700 border-rose-300'
    default: return 'bg-slate-100 text-slate-700 border-slate-300'
  }
}

export function classificationBarColor(clasificacion: string): string {
  switch (clasificacion) {
    case 'EXCELENTE': return '#10b981'
    case 'BUENO': return '#0ea5e9'
    case 'REGULAR': return '#f59e0b'
    case 'MALO': return '#f43f5e'
    default: return '#64748b'
  }
}

export function rowToEvaluation(row: Record<string, unknown>): Evaluation {
  return {
    id: String(row.id),
    proveedor: String(row.proveedor ?? ''),
    correo: row.correo ? String(row.correo) : null,
    fecha: String(row.fecha ?? ''),
    c1: Number(row.c1 ?? 0),
    c2: Number(row.c2 ?? 0),
    c3: Number(row.c3 ?? 0),
    c4: Number(row.c4 ?? 0),
    c5: Number(row.c5 ?? 0),
    c6: Number(row.c6 ?? 0),
    c7: Number(row.c7 ?? 0),
    c8: Number(row.c8 ?? 0),
    c9: Number(row.c9 ?? 0),
    c10: Number(row.c10 ?? 0),
    total: Number(row.total ?? 0),
    calificacion: Number(row.calificacion ?? 0),
    clasificacion: String(row.clasificacion ?? 'MALO'),
    observaciones: String(row.observaciones ?? ''),
    evaluador: String(row.evaluador ?? 'Walter Piñera'),
    cargo: String(row.cargo ?? 'Ingeniero Calidad y Compras'),
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  }
}
