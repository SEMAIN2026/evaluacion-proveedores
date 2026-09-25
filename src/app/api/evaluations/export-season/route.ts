import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureSchema, type Evaluation } from '@/lib/db'

/**
 * GET /api/evaluations/export-season?period=YYYY-MM
 *
 * Generates a polished .xlsx Excel workbook with all the evaluations of
 * the given "temporada" (month + year). If period is omitted, defaults
 * to the most recent month that has at least one evaluation.
 *
 * The workbook has 3 sheets:
 *   1. "Resumen" — KPI cards (count, average, distribution, top/bottom)
 *   2. "Evaluaciones" — one row per evaluation, all 10 criteria + total
 *      + calificacion + clasificacion + datos de contacto + marca enviado
 *   3. "Por Proveedor" — aggregated stats per supplier (avg, count, last)
 *
 * All formatting uses SEMAIN brand colors:
 *   - Header rows: dark charcoal background (#302C2B), white text
 *   - Title: SEMAIN green (#7BA635)
 *   - Classification cells: color-coded (green / blue / amber / red)
 *   - Borders: thin gray
 *   - Frozen panes on each sheet
 */

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function periodLabel(key: string): string {
  if (!key || key.length !== 7) return ''
  const [y, m] = key.split('-')
  const mi = parseInt(m, 10) - 1
  if (mi < 0 || mi > 11) return key
  return `${MONTH_NAMES_ES[mi]} ${y}`
}

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}

// SEMAIN brand colors
const SEMAIN_DARK = 'FF302C2B'
const SEMAIN_GREEN = 'FF7BA635'
const SEMAIN_GREEN_LIGHT = 'FFA0CD50'
const WHITE = 'FFFFFFFF'
const LIGHT_GREEN_TINT = 'FFE8F2D5'

// Classification colors (fill + font)
function classStyle(clasificacion: string): { fill: string; font: string } {
  switch (clasificacion) {
    case 'EXCELENTE': return { fill: 'FF7BA635', font: WHITE }
    case 'BUENO':     return { fill: 'FFA0CD50', font: 'FF302C2B' }
    case 'REGULAR':   return { fill: 'FFE8923C', font: 'FF302C2B' }
    case 'MALO':      return { fill: 'FFD9534F', font: WHITE }
    default:          return { fill: 'FF94A3B8', font: 'FF302C2B' }
  }
}

const CRITERIA_LABELS = [
  'Calidad del producto',
  'Relación precio-calidad',
  'Material en stock',
  'Posibilidad de devolución del producto',
  'Servicio (velocidad de respuesta)',
  'Cumplimiento de fecha de entrega',
  'Servicio post-venta',
  'Pago del transporte',
  'Amabilidad de venta',
  'Envío de material completo',
]

const SCORE_LABELS: Record<number, string> = {
  0: '—',
  1: 'Malo',
  2: 'Regular',
  3: 'Bien',
  4: 'Excelente',
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left:   { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right:  { style: 'thin', color: { argb: 'FFCBD5E1' } },
}

/** Helper: write a styled header row at row 1 of a sheet. */
function writeHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], columnWidths: number[]) {
  headers.forEach((h, i) => {
    const cell = sheet.getCell(1, i + 1)
    cell.value = h
    cell.font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEMAIN_DARK } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = THIN_BORDER
  })
  columnWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
  sheet.getRow(1).height = 32
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function GET(req: NextRequest) {
  await ensureSchema()

  // 1) Determine the period (YYYY-MM) — from query or default to most recent.
  const url = new URL(req.url)
  let period = (url.searchParams.get('period') || '').trim()
  if (!/^\d{4}-\d{2}$/.test(period)) {
    period = ''
  }

  let whereClause = ''
  let args: string[] = []
  if (period) {
    whereClause = `WHERE substr(fecha, 1, 7) = ?`
    args = [period]
  }

  // If no period specified, find the most recent month with evaluations.
  if (!period) {
    const latestRes = await db.execute({
      sql: `SELECT substr(fecha, 1, 7) as period
            FROM evaluations
            WHERE fecha IS NOT NULL AND length(fecha) >= 7
            ORDER BY fecha DESC
            LIMIT 1`,
      args: [],
    })
    if (latestRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'No hay evaluaciones para exportar' },
        { status: 404 }
      )
    }
    period = String(latestRes.rows[0].period)
    whereClause = `WHERE substr(fecha, 1, 7) = ?`
    args = [period]
  }

  // 2) Fetch all evaluations of this period.
  const res = await db.execute({
    sql: `SELECT * FROM evaluations ${whereClause} ORDER BY calificacion DESC, fecha DESC, created_at ASC`,
    args,
  })

  const evals: Evaluation[] = res.rows.map((r) => ({
    id: String(r.id),
    proveedor: String(r.proveedor ?? ''),
    correo: r.correo ? String(r.correo) : null,
    telefono: r.telefono ? String(r.telefono) : null,
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
    created_at: Number(r.created_at ?? 0),
    updated_at: Number(r.updated_at ?? 0),
    enviado: Number(r.enviado ?? 0),
    enviado_tipo: r.enviado_tipo ? String(r.enviado_tipo) : null,
    enviado_fecha: r.enviado_fecha ? Number(r.enviado_fecha) : null,
  }))

  if (evals.length === 0) {
    return NextResponse.json(
      { error: `No hay evaluaciones en ${periodLabel(period)}` },
      { status: 404 }
    )
  }

  // 3) Build the workbook.
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SEMAIN · Evaluación de Proveedores'
  wb.created = new Date()
  wb.properties = {
    title: `Evaluación de Proveedores - ${periodLabel(period)}`,
    subject: 'F-CAL-07 REV01',
    creator: 'SEMAIN',
    company: 'SEMAIN',
  }

  // ---- Sheet 1: Resumen ----
  buildSummarySheet(wb, evals, period)

  // ---- Sheet 2: Evaluaciones ----
  buildEvaluationsSheet(wb, evals)

  // ---- Sheet 3: Por Proveedor ----
  buildBySupplierSheet(wb, evals)

  // 4) Serialize to buffer.
  const buffer = await wb.xlsx.writeBuffer()

  const filename = `evaluaciones_${period}.xlsx`
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

// ============================================================================
// Sheet builders
// ============================================================================

function buildSummarySheet(wb: ExcelJS.Workbook, evals: Evaluation[], period: string) {
  const sheet = wb.addWorksheet('Resumen', {
    properties: { tabColor: { argb: SEMAIN_GREEN } },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  // Column widths
  sheet.columns = [
    { width: 4 },   // A — small margin
    { width: 26 },  // B — label
    { width: 24 },  // C — value
    { width: 24 },  // D — value 2
    { width: 24 },  // E — value 3
  ]

  // ----- Title block -----
  sheet.getCell('B2').value = 'SEMAIN'
  sheet.getCell('B2').font = { name: 'Calibri', bold: true, size: 22, color: { argb: SEMAIN_GREEN } }

  sheet.getCell('B3').value = 'Evaluación de Proveedores · F-CAL-07 REV01'
  sheet.getCell('B3').font = { name: 'Calibri', size: 12, color: { argb: SEMAIN_DARK } }

  sheet.getCell('B4').value = `Temporada: ${periodLabel(period)}`
  sheet.getCell('B4').font = { name: 'Calibri', bold: true, size: 14, color: { argb: SEMAIN_DARK } }

  sheet.getCell('B5').value = `Generado: ${new Date().toLocaleString('es-MX')}`
  sheet.getCell('B5').font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF64748B' } }

  // Thin divider line below the title block (row 7)
  for (let col = 2; col <= 5; col++) {
    const cell = sheet.getCell(7, col)
    cell.border = { bottom: { style: 'medium', color: { argb: SEMAIN_GREEN } } }
  }

  // ----- KPI cards (row 9 — labels, row 10 — values) -----
  const total = evals.length
  const avg = total > 0 ? evals.reduce((s, e) => s + e.calificacion, 0) / total : 0
  const max = total > 0 ? Math.max(...evals.map((e) => e.calificacion)) : 0
  const min = total > 0 ? Math.min(...evals.map((e) => e.calificacion)) : 0
  const sent = evals.filter((e) => Number(e.enviado || 0) === 1).length

  const dist = { EXCELENTE: 0, BUENO: 0, REGULAR: 0, MALO: 0 } as Record<string, number>
  for (const e of evals) {
    dist[e.clasificacion] = (dist[e.clasificacion] || 0) + 1
  }

  const kpiData: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Evaluaciones', value: String(total), sub: 'proveedores' },
    { label: 'Promedio', value: avg.toFixed(1), sub: '/ 100' },
    { label: 'Máxima', value: max.toFixed(1), sub: '/ 100' },
    { label: 'Mínima', value: min.toFixed(1), sub: '/ 100' },
    { label: 'Enviados', value: String(sent), sub: `de ${total}` },
  ]

  kpiData.forEach((kpi, i) => {
    const col = i + 2  // start at column B
    // Label cell (row 9)
    const labelCell = sheet.getCell(9, col)
    labelCell.value = kpi.label
    labelCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF64748B' } }
    labelCell.alignment = { horizontal: 'center' }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN_TINT } }
    labelCell.border = THIN_BORDER
    // Value cell (row 10)
    const valCell = sheet.getCell(10, col)
    valCell.value = kpi.value
    valCell.font = { name: 'Calibri', bold: true, size: 24, color: { argb: SEMAIN_DARK } }
    valCell.alignment = { horizontal: 'center', vertical: 'middle' }
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN_TINT } }
    valCell.border = THIN_BORDER
    // Sub cell (row 11)
    const subCell = sheet.getCell(11, col)
    subCell.value = kpi.sub || ''
    subCell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF64748B' } }
    subCell.alignment = { horizontal: 'center' }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN_TINT } }
    subCell.border = THIN_BORDER
  })
  sheet.getRow(10).height = 36

  // ----- Distribution table -----
  sheet.getCell('B14').value = 'Distribución por clasificación'
  sheet.getCell('B14').font = { name: 'Calibri', bold: true, size: 13, color: { argb: SEMAIN_DARK } }

  const distHeaders = ['Clasificación', 'Rango', 'Cantidad', '% del total']
  distHeaders.forEach((h, i) => {
    const cell = sheet.getCell(15, i + 2)
    cell.value = h
    cell.font = { name: 'Calibri', bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEMAIN_DARK } }
    cell.alignment = { horizontal: 'center' }
    cell.border = THIN_BORDER
  })

  const distRows: Array<{ label: string; range: string; count: number }> = [
    { label: 'EXCELENTE', range: '91 – 100', count: dist['EXCELENTE'] || 0 },
    { label: 'BUENO',     range: '71 – 90',  count: dist['BUENO'] || 0 },
    { label: 'REGULAR',   range: '51 – 70',  count: dist['REGULAR'] || 0 },
    { label: 'MALO',      range: '0 – 50',   count: dist['MALO'] || 0 },
  ]
  distRows.forEach((row, i) => {
    const r = 16 + i
    const style = classStyle(row.label)
    // Class cell — colored
    const classCell = sheet.getCell(r, 2)
    classCell.value = row.label
    classCell.font = { name: 'Calibri', bold: true, color: { argb: style.font } }
    classCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
    classCell.alignment = { horizontal: 'center' }
    classCell.border = THIN_BORDER
    // Range
    const rangeCell = sheet.getCell(r, 3)
    rangeCell.value = row.range
    rangeCell.alignment = { horizontal: 'center' }
    rangeCell.border = THIN_BORDER
    // Count
    const countCell = sheet.getCell(r, 4)
    countCell.value = row.count
    countCell.alignment = { horizontal: 'center' }
    countCell.font = { name: 'Calibri', bold: true, size: 13 }
    countCell.border = THIN_BORDER
    // %
    const pctCell = sheet.getCell(r, 5)
    pctCell.value = total > 0 ? (row.count / total) : 0
    pctCell.numberFormat = '0.0%'
    pctCell.alignment = { horizontal: 'center' }
    pctCell.border = THIN_BORDER
  })

  // ----- Top 5 / Bottom 5 -----
  const sorted = [...evals].sort((a, b) => b.calificacion - a.calificacion)
  const top5 = sorted.slice(0, 5)
  const bottom5 = sorted.slice(-5).reverse()

  sheet.getCell('B22').value = 'Top 5'
  sheet.getCell('B22').font = { name: 'Calibri', bold: true, size: 13, color: { argb: SEMAIN_GREEN } }
  sheet.getCell('D22').value = 'Bottom 5'
  sheet.getCell('D22').font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFD9534F' } }

  for (let i = 0; i < 5; i++) {
    // Top 5 (column B)
    if (top5[i]) {
      const r = 23 + i
      const nameCell = sheet.getCell(r, 2)
      nameCell.value = `${i + 1}. ${top5[i].proveedor}`
      nameCell.font = { name: 'Calibri', size: 11 }
      nameCell.border = THIN_BORDER
      const scoreCell = sheet.getCell(r, 3)
      scoreCell.value = top5[i].calificacion
      scoreCell.numberFormat = '0.0'
      scoreCell.font = { name: 'Calibri', bold: true, size: 12 }
      scoreCell.alignment = { horizontal: 'center' }
      scoreCell.border = THIN_BORDER
      const clsCell = sheet.getCell(r, 4)  // wait, that overlaps. Let me just leave C/D blank for bottom.
    }
    // Bottom 5 (column D / E)
    if (bottom5[i]) {
      const r = 23 + i
      const nameCell = sheet.getCell(r, 4)
      nameCell.value = `${i + 1}. ${bottom5[i].proveedor}`
      nameCell.font = { name: 'Calibri', size: 11 }
      nameCell.border = THIN_BORDER
      const scoreCell = sheet.getCell(r, 5)
      scoreCell.value = bottom5[i].calificacion
      scoreCell.numberFormat = '0.0'
      scoreCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFD9534F' } }
      scoreCell.alignment = { horizontal: 'center' }
      scoreCell.border = THIN_BORDER
    }
  }
}

function buildEvaluationsSheet(wb: ExcelJS.Workbook, evals: Evaluation[]) {
  const sheet = wb.addWorksheet('Evaluaciones', {
    properties: { tabColor: { argb: SEMAIN_DARK } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const headers = [
    '#',
    'Proveedor',
    'Correo',
    'Teléfono',
    'Fecha',
    ...CRITERIA_LABELS,
    'Total',
    'Calificación',
    'Clasificación',
    'Observaciones',
    'Enviado',
  ]
  const colWidths = [
    5,   // #
    28,  // Proveedor
    30,  // Correo
    18,  // Teléfono
    12,  // Fecha
    14, 14, 14, 14, 14, 14, 14, 14, 14, 14,  // 10 criteria
    8,   // Total
    12,  // Calificación
    14,  // Clasificación
    40,  // Observaciones
    16,  // Enviado
  ]
  writeHeaderRow(sheet, headers, colWidths)

  evals.forEach((ev, idx) => {
    const row = sheet.getRow(2 + idx)
    const scoreKeys: (keyof Evaluation)[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']

    row.getCell(1).value = idx + 1
    row.getCell(2).value = ev.proveedor
    row.getCell(3).value = ev.correo || ''
    row.getCell(4).value = ev.telefono || ''
    row.getCell(5).value = formatDate(ev.fecha)
    scoreKeys.forEach((k, i) => {
      const score = Number(ev[k] || 0)
      const cell = row.getCell(6 + i)
      cell.value = score > 0 ? `${score} · ${SCORE_LABELS[score]}` : '—'
      cell.alignment = { horizontal: 'center' }
    })
    row.getCell(16).value = ev.total
    row.getCell(16).alignment = { horizontal: 'center' }
    row.getCell(16).font = { bold: true }

    row.getCell(17).value = ev.calificacion
    row.getCell(17).numberFormat = '0.0'
    row.getCell(17).alignment = { horizontal: 'center' }
    row.getCell(17).font = { bold: true, size: 12 }

    const clsCell = row.getCell(18)
    clsCell.value = ev.clasificacion
    const style = classStyle(ev.clasificacion)
    clsCell.font = { name: 'Calibri', bold: true, color: { argb: style.font } }
    clsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
    clsCell.alignment = { horizontal: 'center' }

    row.getCell(19).value = ev.observaciones || ''
    row.getCell(19).alignment = { wrapText: true, vertical: 'top' }

    const sentCell = row.getCell(20)
    if (Number(ev.enviado || 0) === 1) {
      const sentDate = ev.enviado_fecha ? new Date(ev.enviado_fecha).toLocaleString('es-MX') : ''
      sentCell.value = `Sí · ${ev.enviado_tipo === 'WHATSAPP' ? 'WhatsApp' : ev.enviado_tipo || ''}${sentDate ? ' · ' + sentDate : ''}`
      sentCell.font = { name: 'Calibri', bold: true, color: { argb: SEMAIN_GREEN } }
    } else {
      sentCell.value = 'No'
      sentCell.font = { name: 'Calibri', color: { argb: 'FF94A3B8' } }
    }
    sentCell.alignment = { horizontal: 'center' }

    // Apply borders + zebra stripe to all cells in the row
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = THIN_BORDER
      if (idx % 2 === 1 && !cell.fill || (cell.fill as any)?.pattern !== 'solid') {
        // Don't overwrite the colored cells (clasificacion)
        if (cell !== row.getCell(18)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      }
    })
    row.height = 22
  })

  // Auto-filter on the header row
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + evals.length, column: headers.length },
  }
}

function buildBySupplierSheet(wb: ExcelJS.Workbook, evals: Evaluation[]) {
  const sheet = wb.addWorksheet('Por Proveedor', {
    properties: { tabColor: { argb: SEMAIN_GREEN_LIGHT } },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  // Aggregate by proveedor
  const bySupplier = new Map<string, {
    nombre: string
    count: number
    total: number
    max: number
    min: number
    lastEval: string
    correo: string | null
    telefono: string | null
  }>()
  for (const ev of evals) {
    const key = ev.proveedor
    if (!bySupplier.has(key)) {
      bySupplier.set(key, {
        nombre: ev.proveedor,
        count: 0,
        total: 0,
        max: -Infinity,
        min: Infinity,
        lastEval: ev.fecha,
        correo: ev.correo,
        telefono: ev.telefono,
      })
    }
    const s = bySupplier.get(key)!
    s.count++
    s.total += ev.calificacion
    s.max = Math.max(s.max, ev.calificacion)
    s.min = Math.min(s.min, ev.calificacion)
    // Update lastEval if this ev is more recent
    if (ev.fecha > s.lastEval) {
      s.lastEval = ev.fecha
      s.correo = ev.correo
      s.telefono = ev.telefono
    }
  }

  const aggregated = Array.from(bySupplier.values()).sort((a, b) => (b.total / b.count) - (a.total / a.count))

  const headers = [
    '#',
    'Proveedor',
    'Correo',
    'Teléfono',
    'Evaluaciones',
    'Promedio',
    'Máxima',
    'Mínima',
    'Última evaluación',
  ]
  const colWidths = [5, 28, 30, 18, 14, 12, 12, 12, 18]
  writeHeaderRow(sheet, headers, colWidths)

  aggregated.forEach((s, idx) => {
    const row = sheet.getRow(2 + idx)
    row.getCell(1).value = idx + 1
    row.getCell(2).value = s.nombre
    row.getCell(3).value = s.correo || ''
    row.getCell(4).value = s.telefono || ''
    row.getCell(5).value = s.count
    row.getCell(5).alignment = { horizontal: 'center' }

    const avg = s.count > 0 ? s.total / s.count : 0
    row.getCell(6).value = avg
    row.getCell(6).numberFormat = '0.0'
    row.getCell(6).alignment = { horizontal: 'center' }
    row.getCell(6).font = { bold: true, size: 12 }

    row.getCell(7).value = s.max
    row.getCell(7).numberFormat = '0.0'
    row.getCell(7).alignment = { horizontal: 'center' }

    row.getCell(8).value = s.min
    row.getCell(8).numberFormat = '0.0'
    row.getCell(8).alignment = { horizontal: 'center' }

    row.getCell(9).value = formatDate(s.lastEval)
    row.getCell(9).alignment = { horizontal: 'center' }

    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = THIN_BORDER
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })
    row.height = 22
  })

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + aggregated.length, column: headers.length },
  }
}
