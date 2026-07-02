import { NextResponse } from 'next/server'
import { db, CRITERIA, type Evaluation } from '@/lib/db'

/**
 * GET /api/export?format=csv|json
 * Exports all evaluations as CSV (Excel-compatible, UTF-8 BOM) or JSON.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'csv').toLowerCase()
  const res = await db.execute(
    `SELECT * FROM evaluations ORDER BY datetime(fecha) DESC, created_at DESC`
  )
  const rows = res.rows.map((r) => ({
    id: String(r.id),
    proveedor: String(r.proveedor ?? ''),
    correo: r.correo ? String(r.correo) : '',
    fecha: String(r.fecha ?? ''),
    c1: Number(r.c1 ?? 0),
    c2: Number(r.c2 ?? 0),
    c3: Number(r.c3 ?? 0),
    c4: Number(r.c4 ?? 0),
    c5: Number(r.c5 ?? 0),
    c6: Number(r.c6 ?? 0),
    c7: Number(r.c7 ?? 0),
    c8: Number(r.c8 ?? 0),
    c9: Number(r.c9 ?? 0),
    c10: Number(r.c10 ?? 0),
    total: Number(r.total ?? 0),
    calificacion: Number(r.calificacion ?? 0),
    clasificacion: String(r.clasificacion ?? 'MALO'),
    observaciones: String(r.observaciones ?? ''),
    evaluador: String(r.evaluador ?? 'Walter Piñera'),
    cargo: String(r.cargo ?? 'Ingeniero Calidad y Compras'),
  })) as Evaluation[]

  if (format === 'json') {
    return NextResponse.json({ data: rows })
  }

  // CSV with UTF-8 BOM so Excel detects encoding correctly
  const headers = [
    '#',
    'PROVEEDOR',
    'CORREO',
    'FECHA',
    ...CRITERIA.map((c) => c.label),
    'TOTAL',
    'CALIFICACIÓN',
    'CLASIFICACIÓN',
    'OBSERVACIONES',
    'EVALUADOR',
    'CARGO',
  ]

  const lines: string[] = []
  lines.push(headers.map(csvEscape).join(','))
  rows.forEach((r, i) => {
    lines.push(
      [
        i + 1,
        r.proveedor,
        r.correo,
        r.fecha,
        r.c1, r.c2, r.c3, r.c4, r.c5,
        r.c6, r.c7, r.c8, r.c9, r.c10,
        r.total,
        r.calificacion.toFixed(2),
        r.clasificacion,
        r.observaciones,
        r.evaluador,
        r.cargo,
      ]
        .map((v) => csvEscape(String(v)))
        .join(',')
    )
  })

  const csv = '\ufeff' + lines.join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="evaluaciones-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

function csvEscape(s: string): string {
  if (s == null) return ''
  const needsQuote = /[",\r\n]/.test(s)
  if (needsQuote) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
