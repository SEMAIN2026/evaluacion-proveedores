import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema, type Evaluation } from '@/lib/db'

/**
 * GET /api/evaluations/[id]/eml?to=...&subject=...&body=...
 *
 * Generates a minimal .eml file (RFC 5322 / RFC 2045) that, when opened
 * with a double-click, makes Outlook / Apple Mail / Thunderbird show a
 * brand-new DRAFT with the "Send" button — NOT the reading-pane view
 * with "Reply / Reply All" that happens when the .eml looks like a
 * received message.
 *
 * === The exact header set that works ===
 *
 *   INCLUDE:
 *     From:    <user's Outlook mailbox>
 *     To:      <recipient>
 *     Subject: <subject>
 *     MIME-Version: 1.0
 *     Content-Type: multipart/mixed; boundary="..."
 *
 *   EXCLUDE (any of these makes Outlook treat the file as a *received*
 *   message and shows Reply / Reply All):
 *     Date, Message-ID, In-Reply-To, References, Return-Path,
 *     Delivered-To, X-Mailer, X-Auto-Response-Suppress, Auto-Submitted,
 *     X-MS-*, X-Microsoft-*, Received, X-Original-To, X-Priority.
 *
 * Outlook fills in Date + Message-ID itself when the user hits Send.
 *
 * === Body / attachments ===
 *
 *   - text/plain body, UTF-8, quoted-printable (so non-ASCII works
 *     without surprises).
 *   - PDF evaluation report, base64.
 *   - PNG comparative chart, base64 (optional, included if the chart
 *     endpoint returns OK).
 */

const FROM_EMAIL = 'compras@semain.com.mx'

interface EmlParts {
  to: string
  cc?: string
  subject: string
  body: string
  pdfBuffer: Buffer
  pdfFilename: string
  chartBuffer: Buffer | null
  chartFilename: string
}

function genBoundary(): string {
  return `----=_SEMAIN_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 14)}`
}

/** Encode header value (RFC 2047) for non-ASCII characters. */
function encodeHeader(v: string): string {
  if (!v) return ''
  if (/^[\x20-\x7E]+$/.test(v) && v.length < 78) return v
  const b64 = Buffer.from(v, 'utf-8').toString('base64')
  return `=?UTF-8?B?${b64}?=`
}

/** Encode body as RFC 2045 quoted-printable, line-wrapped at 76 chars. */
function toQuotedPrintable(text: string): string {
  const out: string[] = []
  let lineLen = 0
  const push = (s: string) => {
    if (lineLen + s.length > 75) {
      out.push('=\r\n')
      lineLen = 0
    }
    out.push(s)
    lineLen += s.length
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const code = text.charCodeAt(i)
    if (ch === '\r') continue
    if (ch === '\n') {
      out.push('\r\n')
      lineLen = 0
      continue
    }
    if (ch === ' ' || ch === '\t') {
      const next = text[i + 1]
      if (next === '\n' || next === '\r' || i === text.length - 1) {
        push(`=${code.toString(16).toUpperCase().padStart(2, '0')}`)
      } else {
        push(ch)
      }
      continue
    }
    if (code >= 33 && code <= 126 && ch !== '=') {
      push(ch)
    } else {
      // Encode each UTF-8 byte as =XX
      const bytes = Buffer.from(ch, 'utf-8')
      for (const b of bytes) {
        push(`=${b.toString(16).toUpperCase().padStart(2, '0')}`)
      }
    }
  }
  return out.join('')
}

/** Wrap a base64 string into 76-char lines. */
function wrapBase64(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n')
}

function buildEml(p: EmlParts): string {
  const boundary = genBoundary()

  // ---- Headers ----
  // EXACTLY these 5 headers. No Date. No Message-ID. No X-*.
  const headers: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${p.to}`,
  ]
  if (p.cc) headers.push(`Cc: ${p.cc}`)
  headers.push(`Subject: ${encodeHeader(p.subject)}`)
  headers.push('MIME-Version: 1.0')
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)

  // ---- Body ----
  const parts: string[] = []
  parts.push(`--${boundary}`)
  parts.push('Content-Type: text/plain; charset=UTF-8')
  parts.push('Content-Transfer-Encoding: quoted-printable')
  parts.push('Content-Disposition: inline')
  parts.push('')
  parts.push(toQuotedPrintable(p.body))

  // ---- PDF attachment ----
  parts.push(`--${boundary}`)
  parts.push(`Content-Type: application/pdf; name="${p.pdfFilename}"`)
  parts.push('Content-Transfer-Encoding: base64')
  parts.push(`Content-Disposition: attachment; filename="${p.pdfFilename}"`)
  parts.push('')
  parts.push(wrapBase64(p.pdfBuffer.toString('base64')))

  // ---- Chart attachment (optional) ----
  if (p.chartBuffer) {
    parts.push(`--${boundary}`)
    parts.push(`Content-Type: image/png; name="${p.chartFilename}"`)
    parts.push('Content-Transfer-Encoding: base64')
    parts.push(`Content-Disposition: attachment; filename="${p.chartFilename}"`)
    parts.push('')
    parts.push(wrapBase64(p.chartBuffer.toString('base64')))
  }

  // ---- Closing boundary ----
  parts.push(`--${boundary}--`)
  parts.push('')

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n')
}

function buildDefaultBody(ev: Evaluation, evaluador: string, cargo: string): string {
  return `Estimado equipo de ${ev.proveedor},

Les compartimos los resultados de la evaluación de desempeño como proveedor, realizada el ${formatDate(ev.fecha)}.

RESUMEN DE LA EVALUACIÓN
- Proveedor: ${ev.proveedor}
- Calificación final: ${ev.calificacion.toFixed(1)} / 100
- Clasificación: ${ev.clasificacion}
- Total de puntos: ${ev.total} / 40

Les adjuntamos:
1. El reporte completo en PDF con el detalle por criterio.
2. Una gráfica comparativa que muestra la posición de ${ev.proveedor} frente a los demás proveedores evaluados en el mismo período.

${ev.observaciones && ev.observaciones.trim() !== ''
    ? `OBSERVACIONES:\n${ev.observaciones}\n`
    : 'Sin observaciones.\n'
  }
Quedamos atentos a sus comentarios y a continuar trabajando en la mejora continua.

Saludos cordiales,
${evaluador}
${cargo}`
}

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema()
  const { id } = await params

  // 1) Fetch the evaluation row.
  const res = await db.execute({
    sql: `SELECT * FROM evaluations WHERE id = ? LIMIT 1`,
    args: [id],
  })
  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  }
  const r = res.rows[0]
  const ev: Evaluation = {
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
  }

  // 2) Build header values from query string (or defaults from ev).
  const url = new URL(req.url)
  const to = (url.searchParams.get('to') || ev.correo || '').trim()
  const subject = url.searchParams.get('subject') ||
    `Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`
  const body = url.searchParams.get('body') || buildDefaultBody(ev, ev.evaluador, ev.cargo)
  // Note: fromEmail is intentionally NOT read from the query. It's a
  // constant (compras@semain.com.mx). Allowing it to be overridden is
  // how 'evaluacion@semain.com.mx' snuck back in earlier.

  if (!to) {
    return NextResponse.json(
      { error: 'Falta el destinatario (to)' },
      { status: 400 }
    )
  }

  // 3) Fetch PDF (with chart embedded as a second page) + chart PNG.
  const baseUrl = `${url.protocol}//${url.host}`
  const [pdfRes, chartRes] = await Promise.all([
    fetch(`${baseUrl}/api/evaluations/${id}/pdf?withChart=1`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/evaluations/${id}/chart`, { cache: 'no-store' }).catch(() => null),
  ])
  if (!pdfRes.ok) {
    return NextResponse.json(
      { error: `No se pudo generar el PDF (${pdfRes.status})` },
      { status: 500 }
    )
  }

  const safeName = ev.proveedor.replace(/[^\w\-]+/g, '_')
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  const pdfFilename = `evaluacion-${safeName}.pdf`

  let chartBuffer: Buffer | null = null
  let chartFilename = ''
  if (chartRes && chartRes.ok) {
    chartBuffer = Buffer.from(await chartRes.arrayBuffer())
    chartFilename = `grafica-${safeName}.png`
  }

  // 4) Build the .eml.
  const eml = buildEml({
    to,
    subject,
    body,
    pdfBuffer,
    pdfFilename,
    chartBuffer,
    chartFilename,
  })

  // 5) Mark the evaluation as enviado (EML). Idempotent.
  try {
    const now = Date.now()
    await db.execute({
      sql: `UPDATE evaluations
            SET enviado = 1, enviado_tipo = 'EML', enviado_fecha = ?, updated_at = ?
            WHERE id = ?`,
      args: [now, now, id],
    })
  } catch (e) {
    console.warn('mark-sent after EML generation failed (non-fatal):', e)
  }

  return new NextResponse(eml, {
    status: 200,
    headers: {
      'Content-Type': 'message/rfc822; charset=UTF-8',
      'Content-Disposition': `attachment; filename="evaluacion-${safeName}.eml"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
