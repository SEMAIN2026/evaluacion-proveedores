import { NextRequest, NextResponse } from 'next/server'
import { db, type Evaluation, classificationBarColor } from '@/lib/db'
import sharp from 'sharp'

/**
 * Generates a horizontal bar chart PNG showing all providers' scores,
 * with the requested provider highlighted.
 *
 * Width: 1200, dynamic height based on provider count.
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
  })) as Pick<Evaluation, 'id' | 'proveedor' | 'correo' | 'fecha' | 'calificacion' | 'clasificacion' | 'total'>[]

  if (all.length === 0) {
    return NextResponse.json({ error: 'sin datos' }, { status: 404 })
  }

  const target = all.find((e) => e.id === id)
  if (!target) {
    return NextResponse.json({ error: 'proveedor no encontrado' }, { status: 404 })
  }

  const svg = buildBarChartSVG(all, id)

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()

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

function buildBarChartSVG(
  all: Pick<Evaluation, 'id' | 'proveedor' | 'calificacion' | 'clasificacion'>[],
  highlightId: string
): string {
  // Sort by calificacion DESC so #1 is at the top
  const sorted = [...all].sort((a, b) => b.calificacion - a.calificacion)
  const n = sorted.length
  const targetIdx = sorted.findIndex((e) => e.id === highlightId)

  // Layout
  const W = 1200
  const padL = 280 // room for provider names
  const padR = 140 // room for score + classification
  const padT = 110 // header
  const padB = 60
  const rowH = n <= 8 ? 56 : n <= 15 ? 42 : 32
  const gap = n <= 8 ? 14 : n <= 15 ? 10 : 6
  const chartW = W - padL - padR
  const chartH = n * (rowH + gap)
  const H = chartH + padT + padB

  const maxScore = 100

  // Header band
  const header = `
    <rect x="0" y="0" width="${W}" height="${padT - 20}" fill="#0f172a"/>
    <text x="40" y="48" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">
      Comparativo de Proveedores
    </text>
    <text x="40" y="78" font-family="Inter, Arial, sans-serif" font-size="15" fill="#cbd5e1">
      Posición de ${escapeXml(sorted[targetIdx]?.proveedor ?? '')} frente a ${n - 1} proveedor${n - 1 === 1 ? '' : 'es'} evaluado${n - 1 === 1 ? '' : 's'}
    </text>
    <text x="${W - 40}" y="48" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="14" fill="#94a3b8">
      Generado: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
    </text>
    <text x="${W - 40}" y="72" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="13" fill="#64748b">
      Escala 0 - 100
    </text>
  `

  // Reference vertical lines at 25/50/75/100
  const refLines = [25, 50, 75, 100]
    .map((v) => {
      const x = padL + (v / maxScore) * chartW
      return `
        <line x1="${x}" y1="${padT - 10}" x2="${x}" y2="${H - padB + 4}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 4"/>
        <text x="${x}" y="${H - padB + 24}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" fill="#94a3b8">${v}</text>
      `
    })
    .join('')

  // Bars
  const bars = sorted
    .map((e, i) => {
      const y = padT + i * (rowH + gap)
      const isTarget = e.id === highlightId
      const w = Math.max(2, (e.calificacion / maxScore) * chartW)
      const barColor = classificationBarColor(e.clasificacion)
      const labelColor = isTarget ? '#0f172a' : '#334155'
      const labelWeight = isTarget ? '700' : '500'
      const rankText = `#${i + 1}`
      const providerLabel = e.proveedor.length > 32 ? e.proveedor.slice(0, 31) + '…' : e.proveedor
      const scoreText = e.calificacion.toFixed(1)
      const rankBg = isTarget ? '#fde68a' : '#f1f5f9'
      const rankFg = isTarget ? '#92400e' : '#64748b'

      // Background highlight strip for the target row
      const rowBg = isTarget
        ? `<rect x="20" y="${y - 4}" width="${W - 40}" height="${rowH + 8}" rx="6" fill="#fef3c7" stroke="#fcd34d" stroke-width="1.5"/>`
        : ''

      return `
        ${rowBg}
        <text x="40" y="${y + rowH / 2 + 5}" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="${rankFg}">${rankText}</text>
        <rect x="68" y="${y + rowH / 2 - 8}" width="22" height="16" rx="3" fill="${rankBg}"/>
        <text x="79" y="${y + rowH / 2 + 4}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${rankFg}">${i + 1}</text>
        <text x="98" y="${y + rowH / 2 + 5}" font-family="Inter, Arial, sans-serif" font-size="${isTarget ? 14 : 13}" font-weight="${labelWeight}" fill="${labelColor}">${escapeXml(providerLabel)}</text>
        <rect x="${padL}" y="${y}" width="${w}" height="${rowH}" rx="4" fill="${barColor}" opacity="${isTarget ? 1 : 0.78}"/>
        ${isTarget ? `<rect x="${padL}" y="${y}" width="${w}" height="${rowH}" rx="4" fill="none" stroke="#0f172a" stroke-width="2"/>` : ''}
        <text x="${padL + w + 8}" y="${y + rowH / 2 + 5}" font-family="Inter, Arial, sans-serif" font-size="${isTarget ? 14 : 12}" font-weight="700" fill="${isTarget ? '#0f172a' : '#475569'}">${scoreText}</text>
        <text x="${padL + chartW + 10}" y="${y + rowH / 2 + 5}" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="600" fill="${barColor}">${e.clasificacion}</text>
      `
    })
    .join('')

  // Footer note
  const footer = `
    <text x="40" y="${H - 18}" font-family="Inter, Arial, sans-serif" font-size="11" fill="#94a3b8">
      Clasificación: EXCELENTE (91-100) · BUENO (71-90) · REGULAR (51-70) · MALO (0-50)
    </text>
    <text x="${W - 40}" y="${H - 18}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="11" fill="#94a3b8">
      Tu proveedor aparece resaltado en amarillo
    </text>
  `

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  ${header}
  <line x1="20" y1="${padT - 20}" x2="${W - 20}" y2="${padT - 20}" stroke="#e2e8f0" stroke-width="1"/>
  ${refLines}
  ${bars}
  ${footer}
</svg>`
}
