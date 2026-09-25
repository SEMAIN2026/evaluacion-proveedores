import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema, type Evaluation } from '@/lib/db'
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * Generates a formal horizontal bar chart PNG showing all providers' scores
 * FOR THE SAME PERIOD (month + year) as the requested evaluation, with the
 * current provider highlighted.
 *
 * Each "temporada" (period = month + year) is INDEPENDENT — evaluations from
 * February do NOT appear in a September chart, and vice versa.
 *
 * Layout improvements vs. previous version:
 *   - Header: logo on left, title stacked BELOW the logo (no overlap)
 *   - Period label prominently shown ("Septiembre 2026")
 *   - Provider names wrap to 2 lines instead of being truncated with "..."
 *   - Legend has its own row with generous spacing, no clipping
 *   - Better contrast for score text inside bars
 */

interface ChartRow {
  id: string
  proveedor: string
  fecha: string
  calificacion: number
  clasificacion: string
  total: number
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function periodKey(fecha: string): string {
  // fecha is expected as YYYY-MM-DD (ISO)
  if (!fecha || fecha.length < 7) return ''
  return fecha.slice(0, 7) // "YYYY-MM"
}

function periodLabel(key: string): string {
  if (!key || key.length !== 7) return ''
  const [y, m] = key.split('-')
  const mi = parseInt(m, 10) - 1
  if (mi < 0 || mi > 11) return key
  return `${MONTH_NAMES_ES[mi]} ${y}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema()
  const { id } = await params

  // 1) Fetch the TARGET evaluation first to know its period (YYYY-MM).
  const targetRes = await db.execute({
    sql: `SELECT id, proveedor, fecha, calificacion, clasificacion, total
          FROM evaluations WHERE id = ? LIMIT 1`,
    args: [id],
  })
  if (targetRes.rows.length === 0) {
    return NextResponse.json({ error: 'proveedor no encontrado' }, { status: 404 })
  }
  const targetRow = targetRes.rows[0]
  const targetFecha = String(targetRow.fecha ?? '')
  const targetPeriod = periodKey(targetFecha)

  // 2) Fetch ALL evaluations of the SAME PERIOD as the target.
  //    Each month/year is its own "temporada" — independent of the others.
  let allRows: ChartRow[]
  if (targetPeriod) {
    const samePeriodRes = await db.execute({
      sql: `SELECT id, proveedor, fecha, calificacion, clasificacion, total
            FROM evaluations
            WHERE substr(fecha, 1, 7) = ?
            ORDER BY calificacion DESC, created_at ASC`,
      args: [targetPeriod],
    })
    allRows = samePeriodRes.rows.map((r) => ({
      id: String(r.id),
      proveedor: String(r.proveedor ?? ''),
      fecha: String(r.fecha ?? ''),
      calificacion: Number(r.calificacion ?? 0),
      clasificacion: String(r.clasificacion ?? 'MALO'),
      total: Number(r.total ?? 0),
    }))
  } else {
    // Fallback: if target has no parseable date, just show itself
    allRows = [
      {
        id: String(targetRow.id),
        proveedor: String(targetRow.proveedor ?? ''),
        fecha: targetFecha,
        calificacion: Number(targetRow.calificacion ?? 0),
        clasificacion: String(targetRow.clasificacion ?? 'MALO'),
        total: Number(targetRow.total ?? 0),
      },
    ]
  }

  if (allRows.length === 0) {
    return NextResponse.json({ error: 'sin datos en el período' }, { status: 404 })
  }

  // Load fonts via file paths (resvg-js needs actual file paths)
  const fontDir = join(process.cwd(), 'public', 'fonts')
  const fontRegularPath = join(fontDir, 'Carlito-Regular.ttf')
  const fontBoldPath = join(fontDir, 'Carlito-Bold.ttf')

  const logoPath = join(process.cwd(), 'public', 'assets', 'logo.png')
  let logoBase64: string | null = null
  try {
    const logoBuf = await readFile(logoPath)
    logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`
  } catch {
    // logo not found — chart will work without it
  }

  const svg = buildChartSVG({
    rows: allRows,
    highlightId: id,
    logoBase64,
    periodLabel: periodLabel(targetPeriod),
    targetNombre: String(targetRow.proveedor ?? ''),
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1400 },
    font: {
      loadSystemFonts: false,
      fontFiles: [fontRegularPath, fontBoldPath],
      defaultFontFamily: 'Carlito',
    },
  })

  const pngBuffer = resvg.render().asPng()

  const safeName = String(targetRow.proveedor ?? 'proveedor').replace(/\s+/g, '_')
  return new NextResponse(pngBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="grafica-${safeName}.png"`,
    },
  })
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Split a long provider name into up to 2 lines for display in the chart. */
function wrapName(s: string, maxCharsPerLine: number): string[] {
  const clean = s.trim()
  if (clean.length <= maxCharsPerLine) return [clean]
  // Try to break on a space near the middle
  const half = Math.floor(clean.length / 2)
  // Search outward from the middle for a space
  let breakAt = -1
  for (let offset = 0; offset < half; offset++) {
    if (clean[half + offset] === ' ') { breakAt = half + offset; break }
    if (clean[half - offset] === ' ') { breakAt = half - offset; break }
  }
  if (breakAt <= 0) {
    // No space found — hard-break at maxCharsPerLine
    return [clean.slice(0, maxCharsPerLine - 1) + '…', '']
  }
  const line1 = clean.slice(0, breakAt).trim()
  let line2 = clean.slice(breakAt + 1).trim()
  if (line2.length > maxCharsPerLine) {
    line2 = line2.slice(0, maxCharsPerLine - 1) + '…'
  }
  return [line1, line2]
}

// SEMAIN brand colors (extracted from logo)
// - Logo green: ~#A0CD50 (lime/leaf green)
// - Logo dark: ~#302C2B (charcoal)
const SEMAIN_GREEN = '#A0CD50'
const SEMAIN_GREEN_DARK = '#7BA635'
const SEMAIN_DARK = '#302C2B'

function classificationColor(c: string): string {
  switch (c) {
    case 'EXCELENTE': return '#7BA635'  // darker SEMAIN green — better contrast
    case 'BUENO': return '#3B82C4'      // deeper blue — better contrast on white
    case 'REGULAR': return '#D97706'    // deeper amber — better contrast
    case 'MALO': return '#B91C1C'       // deeper red — better contrast
    default: return '#64748b'
  }
}

// Bar fill (slightly brighter than the text color so the bar still pops
// while the label next to it stays readable on white).
function classificationBarColor(c: string): string {
  switch (c) {
    case 'EXCELENTE': return '#A0CD50'
    case 'BUENO': return '#5B9BD5'
    case 'REGULAR': return '#F0A030'
    case 'MALO': return '#D9534F'
    default: return '#94a3b8'
  }
}

interface BuildChartArgs {
  rows: ChartRow[]
  highlightId: string
  logoBase64: string | null
  periodLabel: string
  targetNombre: string
}

function buildChartSVG({ rows, highlightId, logoBase64, periodLabel, targetNombre }: BuildChartArgs): string {
  const sorted = [...rows].sort((a, b) => b.calificacion - a.calificacion)
  const n = sorted.length
  const targetIdx = sorted.findIndex((e) => e.id === highlightId)
  const target = sorted[targetIdx]

  // Layout dimensions
  const W = 1400
  const padL = 60
  const padR = 60
  const padTop = 130 // header with logo + 2-line title below

  // Name column — wider to fit most names, with wrap-to-2-lines fallback
  const nameColW = 380
  const rankColW = 50
  const barStart = padL + rankColW + nameColW + 20
  const rightGutter = 150 // space for score + classification label
  const barEnd = W - padR - rightGutter
  const chartW = barEnd - barStart

  // Row dimensions — taller when there are few rows, shorter when many
  // (rows can have 2-line names; allow extra height)
  const rowH = n <= 6 ? 56 : n <= 10 ? 48 : n <= 15 ? 40 : n <= 25 ? 34 : 30
  const rowGap = n <= 6 ? 16 : n <= 10 ? 12 : n <= 15 ? 10 : 8
  const chartH = n * (rowH + rowGap)
  const gridLabelY = padTop + chartH + 22
  const legendY = gridLabelY + 35
  const footerY = legendY + 30
  const H = footerY + 25

  // ---- HEADER ----
  // Layout: logo on LEFT (height 50, vertically centered in 80px band).
  // Title is BELOW the logo on the left (left-aligned), in 2 stacked lines.
  // Period label + "Evaluación comparativa" on the RIGHT, right-aligned.
  // Date + scale info below that on the RIGHT.
  // A thin SEMAIN-green accent line under the entire header.
  let header = `
    <rect x="0" y="0" width="${W}" height="${padTop - 20}" fill="#ffffff"/>
  `
  if (logoBase64) {
    header += `<image href="${logoBase64}" x="${padL}" y="18" height="50" preserveAspectRatio="xMidYMid meet"/>`
  }
  // Title (LEFT, below the logo) — with generous vertical separation
  // so the subtitle never looks "glued" to the title.
  header += `
    <text x="${padL}" y="88" font-family="Carlito" font-size="22" font-weight="700" fill="${SEMAIN_DARK}">
      Comparativo de Evaluación de Proveedores
    </text>
    <text x="${padL}" y="114" font-family="Carlito" font-size="13" fill="${SEMAIN_GREEN_DARK}">
      Posición de ${escapeXml(truncate(target?.proveedor ?? '', 60))} frente a ${n - 1} proveedor${n - 1 === 1 ? '' : 'es'} de la misma temporada
    </text>
  `
  // Right side: period label + scale info
  header += `
    <text x="${W - padR}" y="38" text-anchor="end" font-family="Carlito" font-size="11" fill="#64748b" letter-spacing="1">
      TEMPORADA
    </text>
    <text x="${W - padR}" y="62" text-anchor="end" font-family="Carlito" font-size="20" font-weight="700" fill="${SEMAIN_DARK}">
      ${escapeXml(periodLabel)}
    </text>
    <text x="${W - padR}" y="84" text-anchor="end" font-family="Carlito" font-size="12" fill="#475569">
      ${n} proveedor${n === 1 ? '' : 'es'} evaluado${n === 1 ? '' : 's'} en este período
    </text>
    <text x="${W - padR}" y="102" text-anchor="end" font-family="Carlito" font-size="11" fill="#94a3b8">
      Escala 0 – 100
    </text>
  `
  // (Línea verde del header eliminada a petición del usuario — se
  //  superponía con el subtítulo "Posición de ... frente a ...".)
  // header += `<rect x="0" y="${padTop - 22}" width="${W}" height="3" fill="${SEMAIN_GREEN}"/>`

  // ---- GRIDLINES (vertical reference) ----
  let gridlines = ''
  for (const v of [0, 25, 50, 75, 100]) {
    const x = barStart + (v / 100) * chartW
    gridlines += `<line x1="${x}" y1="${padTop - 10}" x2="${x}" y2="${padTop + chartH + 5}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 4"/>`
    gridlines += `<text x="${x}" y="${gridLabelY}" text-anchor="middle" font-family="Carlito" font-size="12" fill="#94a3b8" font-weight="600">${v}</text>`
  }

  // ---- CLASSIFICATION ZONES (subtle background) ----
  let zones = ''
  const zones_data = [
    { from: 91, to: 100, color: SEMAIN_GREEN, label: 'EXCELENTE' },
    { from: 71, to: 91, color: '#5B9BD5', label: 'BUENO' },
    { from: 51, to: 71, color: '#F0A030', label: 'REGULAR' },
    { from: 0, to: 51, color: '#D9534F', label: 'MALO' },
  ]
  for (const z of zones_data) {
    const x1 = barStart + (z.from / 100) * chartW
    const x2 = barStart + (z.to / 100) * chartW
    zones += `<rect x="${x1}" y="${padTop - 10}" width="${x2 - x1}" height="${chartH + 15}" fill="${z.color}" opacity="0.05"/>`
  }
  // Subtle zone dividers at the thresholds (51, 71, 91)
  for (const threshold of [51, 71, 91]) {
    const x = barStart + (threshold / 100) * chartW
    zones += `<line x1="${x}" y1="${padTop - 10}" x2="${x}" y2="${padTop + chartH + 5}" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2 4"/>`
  }

  // ---- BARS ----
  let bars = ''
  sorted.forEach((e, i) => {
    const y = padTop + i * (rowH + rowGap)
    const isTarget = e.id === highlightId
    const w = Math.max(2, (e.calificacion / 100) * chartW)
    const barColor = classificationBarColor(e.clasificacion)
    const labelColor = classificationColor(e.clasificacion)
    const scoreText = e.calificacion.toFixed(1)

    // Row background: highlight for target, alternating subtle stripe otherwise
    if (isTarget) {
      bars += `<rect x="${padL - 10}" y="${y - 5}" width="${W - padL - padR + 20}" height="${rowH + 10}" rx="6" fill="#E8F2D5" stroke="${SEMAIN_GREEN}" stroke-width="1.5"/>`
    } else if (i % 2 === 0) {
      bars += `<rect x="${padL - 5}" y="${y - 2}" width="${W - padL - padR + 10}" height="${rowH + 4}" fill="#f8fafc"/>`
    }

    // Rank number — colored for target
    bars += `<text x="${padL + 10}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="14" font-weight="700" fill="${isTarget ? SEMAIN_GREEN_DARK : '#64748b'}">#${i + 1}</text>`

    // Provider name — wrap to 2 lines if long, vertically centered
    const maxChars = Math.floor(nameColW / 7.5) // approx 7.5px per char at size 13
    const lines = wrapName(e.proveedor, maxChars)
    const fontSize = isTarget ? 14 : 13
    const textColor = isTarget ? SEMAIN_DARK : '#334155'
    if (lines.length === 1 || !lines[1]) {
      bars += `<text x="${padL + rankColW + 15}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="${fontSize}" font-weight="${isTarget ? 700 : 500}" fill="${textColor}">${escapeXml(lines[0])}</text>`
    } else {
      // 2-line wrap: line 1 above center, line 2 below
      const line1Y = y + rowH / 2 - 3
      const line2Y = y + rowH / 2 + 13
      bars += `<text x="${padL + rankColW + 15}" y="${line1Y}" font-family="Carlito" font-size="${fontSize - 1}" font-weight="${isTarget ? 700 : 500}" fill="${textColor}">${escapeXml(lines[0])}</text>`
      bars += `<text x="${padL + rankColW + 15}" y="${line2Y}" font-family="Carlito" font-size="${fontSize - 1}" font-weight="${isTarget ? 700 : 500}" fill="${textColor}">${escapeXml(lines[1])}</text>`
    }

    // Bar
    bars += `<rect x="${barStart}" y="${y}" width="${w}" height="${rowH}" rx="4" fill="${barColor}" opacity="${isTarget ? 1 : 0.85}"/>`
    if (isTarget) {
      bars += `<rect x="${barStart}" y="${y}" width="${w}" height="${rowH}" rx="4" fill="none" stroke="${SEMAIN_DARK}" stroke-width="2"/>`
    }

    // Score text — INSIDE the bar (white, right-aligned) if there's room,
    // otherwise AFTER the bar (dark text).
    const minBarWidthForInsideText = 60
    if (w > minBarWidthForInsideText) {
      bars += `<text x="${barStart + w - 10}" y="${y + rowH / 2 + 5}" text-anchor="end" font-family="Carlito" font-size="${isTarget ? 15 : 13}" font-weight="700" fill="#ffffff">${scoreText}</text>`
    } else {
      bars += `<text x="${barStart + w + 8}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="${isTarget ? 15 : 13}" font-weight="700" fill="${isTarget ? SEMAIN_DARK : '#475569'}">${scoreText}</text>`
    }

    // Classification label — fixed column on the right, no overlap with score
    bars += `<text x="${barEnd + 15}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="13" font-weight="700" fill="${labelColor}">${e.clasificacion}</text>`
  })

  // ---- LEGEND (its own row, with generous spacing) ----
  // Centered as a single row, with enough room between items to never clip.
  const legendItems = [
    { label: 'EXCELENTE (91 – 100)', color: SEMAIN_GREEN, textColor: SEMAIN_GREEN_DARK },
    { label: 'BUENO (71 – 90)', color: '#5B9BD5', textColor: '#3B82C4' },
    { label: 'REGULAR (51 – 70)', color: '#F0A030', textColor: '#D97706' },
    { label: 'MALO (0 – 50)', color: '#D9534F', textColor: '#B91C1C' },
  ]
  // Compute total width so we can center the legend block.
  const swatchW = 16, swatchGap = 6, itemPadR = 32
  // Approx text width: 6.5 px per char at size 12
  const legendItemWidths = legendItems.map(it => swatchW + swatchGap + it.label.length * 6.5 + itemPadR)
  const legendTotalW = legendItemWidths.reduce((a, b) => a + b, 0)
  let lx = (W - legendTotalW) / 2
  if (lx < padL) lx = padL

  let legend = ''
  legend += `<text x="${padL}" y="${legendY - 22}" font-family="Carlito" font-size="12" font-weight="700" fill="${SEMAIN_DARK}" letter-spacing="0.5">CLASIFICACIÓN</text>`
  legendItems.forEach((it, i) => {
    const w = legendItemWidths[i]
    legend += `<rect x="${lx}" y="${legendY - 11}" width="${swatchW}" height="${swatchW}" rx="3" fill="${it.color}"/>`
    legend += `<text x="${lx + swatchW + swatchGap}" y="${legendY + 2}" font-family="Carlito" font-size="12" font-weight="600" fill="${it.textColor}">${escapeXml(it.label)}</text>`
    lx += w
  })

  // ---- FOOTER ----
  // (Texto explicativo "Cada temporada..." eliminado a petición del
  //  usuario — solo se conserva la línea divisoria y la marca de agua.)
  const footer = `
    <line x1="${padL}" y1="${footerY - 12}" x2="${W - padR}" y2="${footerY - 12}" stroke="#e2e8f0" stroke-width="1"/>
    <text x="${W - padR}" y="${footerY}" text-anchor="end" font-family="Carlito" font-size="12" font-weight="600" fill="#64748b">
      SEMAIN · F-CAL-07 REV01
    </text>
  `

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  ${header}
  <line x1="0" y1="${padTop - 20}" x2="${W}" y2="${padTop - 20}" stroke="#e2e8f0" stroke-width="1"/>
  ${zones}
  ${gridlines}
  ${bars}
  ${legend}
  ${footer}
</svg>`
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 1) + '…'
}
