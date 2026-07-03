import { NextRequest, NextResponse } from 'next/server'
import { db, type Evaluation } from '@/lib/db'
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * Generates a formal, professional horizontal bar chart PNG showing all
 * providers' scores, with the current provider highlighted.
 *
 * Uses @resvg/resvg-js for proper font rendering (sharp/librsvg was rendering
 * text as boxes/tofu on Vercel's serverless environment).
 *
 * Features:
 *   - SEMAIN logo at top
 *   - Title + date
 *   - Horizontal bars sorted by score (highest at top)
 *   - Provider names fully visible (not truncated)
 *   - Score + classification on each bar
 *   - Current provider highlighted with yellow background
 *   - Classification legend at bottom
 *   - Compact data table below the chart
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await db.execute(
    `SELECT * FROM evaluations ORDER BY calificacion DESC, created_at ASC`
  )
  const all = res.rows.map((r) => ({
    id: String(r.id),
    proveedor: String(r.proveedor ?? ''),
    correo: r.correo ? String(r.correo) : null,
    fecha: String(r.fecha ?? ''),
    calificacion: Number(r.calificacion ?? 0),
    clasificacion: String(r.clasificacion ?? 'MALO'),
    total: Number(r.total ?? 0),
  }))

  if (all.length === 0) {
    return NextResponse.json({ error: 'sin datos' }, { status: 404 })
  }

  const target = all.find((e) => e.id === id)
  if (!target) {
    return NextResponse.json({ error: 'proveedor no encontrado' }, { status: 404 })
  }

  // Load fonts via file paths (resvg-js needs actual file paths, not data URLs)
  const fontDir = join(process.cwd(), 'public', 'fonts')
  const fontRegularPath = join(fontDir, 'Carlito-Regular.ttf')
  const fontBoldPath = join(fontDir, 'Carlito-Bold.ttf')

  const logoPath = join(process.cwd(), 'public', 'assets', 'logo.png')
  let logoBase64: string | null = null
  try {
    const logoBuf = await readFile(logoPath)
    logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`
  } catch {
    // logo not found - chart will work without it
  }

  const svg = buildChartSVG(all, id, logoBase64)

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1400 },
    font: {
      loadSystemFonts: false,
      fontFiles: [fontRegularPath, fontBoldPath],
      defaultFontFamily: 'Carlito',
    },
  })

  const pngBuffer = resvg.render().asPng()

  return new NextResponse(pngBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="grafica-${target.proveedor.replace(/\s+/g, '_')}.png"`,
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

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 1) + '…'
}

// SEMAIN brand colors (extracted from logo)
// - Logo green: ~#A0CD50 (lime/leaf green)
// - Logo dark: ~#302C2B (charcoal)
const SEMAIN_GREEN = '#A0CD50'
const SEMAIN_GREEN_DARK = '#7BA635'
const SEMAIN_DARK = '#302C2B'

function classificationColor(c: string): string {
  switch (c) {
    case 'EXCELENTE': return '#A0CD50'  // SEMAIN green
    case 'BUENO': return '#5B9BD5'      // soft blue
    case 'REGULAR': return '#F0A030'    // amber
    case 'MALO': return '#D9534F'       // muted red
    default: return '#64748b'
  }
}

function buildChartSVG(
  all: Array<{ id: string; proveedor: string; correo: string | null; fecha: string; calificacion: number; clasificacion: string; total: number }>,
  highlightId: string,
  logoBase64: string | null
): string {
  const sorted = [...all].sort((a, b) => b.calificacion - a.calificacion)
  const n = sorted.length
  const targetIdx = sorted.findIndex((e) => e.id === highlightId)
  const target = sorted[targetIdx]

  // Layout dimensions
  const W = 1400
  const padL = 50
  const padR = 50
  const padTop = 120 // header with logo + title
  const nameColW = 320 // provider name column
  const barStart = padL + nameColW + 20
  const barEnd = W - padR - 120 // leave room for score + classification text
  const chartW = barEnd - barStart

  // Row dimensions
  const rowH = n <= 6 ? 48 : n <= 10 ? 42 : n <= 15 ? 34 : 28
  const rowGap = n <= 6 ? 14 : n <= 10 ? 10 : 8
  const chartH = n * (rowH + rowGap)
  const legendY = padTop + chartH + 30
  const H = legendY + 50 // chart + legend, NO table

  // Header — SEMAIN brand colors: dark charcoal background + green accent line
  // Logo aligned LEFT, title centered, date on right
  let header = `
    <rect x="0" y="0" width="${W}" height="${padTop - 20}" fill="${SEMAIN_DARK}"/>
    <rect x="0" y="${padTop - 22}" width="${W}" height="3" fill="${SEMAIN_GREEN}"/>
  `
  if (logoBase64) {
    // Logo on the LEFT, vertically centered in header
    header += `<image href="${logoBase64}" x="${padL}" y="30" height="55" preserveAspectRatio="xMidYMid meet"/>`
  }
  header += `
    <text x="${W / 2}" y="55" text-anchor="middle" font-family="Carlito" font-size="24" font-weight="700" fill="#ffffff">
      Comparativo de Evaluación de Proveedores
    </text>
    <text x="${W / 2}" y="80" text-anchor="middle" font-family="Carlito" font-size="13" fill="${SEMAIN_GREEN}">
      Posición de ${escapeXml(target?.proveedor ?? '')} frente a ${n - 1} proveedor${n - 1 === 1 ? '' : 'es'} evaluado${n - 1 === 1 ? '' : 's'}
    </text>
    <text x="${W - padR}" y="50" text-anchor="end" font-family="Carlito" font-size="13" fill="#cbd5e1">
      ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
    </text>
    <text x="${W - padR}" y="72" text-anchor="end" font-family="Carlito" font-size="12" fill="#94a3b8">
      Escala 0 - 100
    </text>
  `

  // Reference vertical gridlines
  let gridlines = ''
  for (const v of [0, 25, 50, 75, 100]) {
    const x = barStart + (v / 100) * chartW
    gridlines += `<line x1="${x}" y1="${padTop - 10}" x2="${x}" y2="${padTop + chartH + 5}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 4"/>`
    gridlines += `<text x="${x}" y="${padTop + chartH + 22}" text-anchor="middle" font-family="Carlito" font-size="11" fill="#94a3b8">${v}</text>`
  }

  // Classification zone backgrounds (very subtle)
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

  // Bars
  let bars = ''
  sorted.forEach((e, i) => {
    const y = padTop + i * (rowH + rowGap)
    const isTarget = e.id === highlightId
    const w = Math.max(2, (e.calificacion / 100) * chartW)
    const barColor = classificationColor(e.clasificacion)
    const providerLabel = truncate(e.proveedor, 42)
    const scoreText = e.calificacion.toFixed(1)

    // Row background highlight for target — use SEMAIN green tint
    if (isTarget) {
      bars += `<rect x="${padL - 10}" y="${y - 4}" width="${W - padL - padR + 20}" height="${rowH + 8}" rx="6" fill="#E8F2D5" stroke="${SEMAIN_GREEN}" stroke-width="1.5"/>`
    } else if (i % 2 === 0) {
      bars += `<rect x="${padL - 5}" y="${y - 2}" width="${W - padL - padR + 10}" height="${rowH + 4}" fill="#f8fafc"/>`
    }

    // Rank number — use SEMAIN green for target
    bars += `<text x="${padL}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="13" font-weight="700" fill="${isTarget ? SEMAIN_GREEN_DARK : '#64748b'}">#${i + 1}</text>`

    // Provider name
    bars += `<text x="${padL + 35}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="${isTarget ? 15 : 13}" font-weight="${isTarget ? 700 : 500}" fill="${isTarget ? SEMAIN_DARK : '#334155'}">${escapeXml(providerLabel)}</text>`

    // Bar
    bars += `<rect x="${barStart}" y="${y}" width="${w}" height="${rowH}" rx="4" fill="${barColor}" opacity="${isTarget ? 1 : 0.78}"/>`
    if (isTarget) {
      bars += `<rect x="${barStart}" y="${y}" width="${w}" height="${rowH}" rx="4" fill="none" stroke="${SEMAIN_DARK}" stroke-width="2"/>`
    }

    // Score text (after the bar)
    bars += `<text x="${barStart + w + 8}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="${isTarget ? 15 : 13}" font-weight="700" fill="${isTarget ? SEMAIN_DARK : '#475569'}">${scoreText}</text>`

    // Classification text (at the right)
    bars += `<text x="${barEnd + 15}" y="${y + rowH / 2 + 5}" font-family="Carlito" font-size="12" font-weight="600" fill="${barColor}">${e.clasificacion}</text>`
  })

  // Legend at bottom of chart — NO table below
  let legend = `<text x="${padL}" y="${legendY}" font-family="Carlito" font-size="12" font-weight="700" fill="${SEMAIN_DARK}">Clasificación:</text>`
  const legendItems = [
    { label: 'EXCELENTE (91-100)', color: SEMAIN_GREEN },
    { label: 'BUENO (71-90)', color: '#5B9BD5' },
    { label: 'REGULAR (51-70)', color: '#F0A030' },
    { label: 'MALO (0-50)', color: '#D9534F' },
  ]
  legendItems.forEach((item, i) => {
    const x = padL + 110 + i * 220
    legend += `<rect x="${x}" y="${legendY - 10}" width="14" height="14" rx="2" fill="${item.color}"/>`
    legend += `<text x="${x + 20}" y="${legendY + 1}" font-family="Carlito" font-size="11" fill="#475569">${item.label}</text>`
  })

  // Footer note (no table)
  const footerY = legendY + 25
  const footer = `
    <text x="${padL}" y="${footerY}" font-family="Carlito" font-size="11" fill="#94a3b8">
      El proveedor evaluado aparece resaltado. La gráfica muestra la posición comparativa entre todos los proveedores evaluados.
    </text>
    <text x="${W - padR}" y="${footerY}" text-anchor="end" font-family="Carlito" font-size="11" fill="#94a3b8">
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

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}
