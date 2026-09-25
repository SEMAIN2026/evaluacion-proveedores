import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema, type Evaluation } from '@/lib/db'

/**
 * GET /api/evaluations/[id]/eml?to=...&subject=...&body=...
 *
 * Generates a complete RFC 822 .eml file (downloadable) with:
 *   - Headers: From, To, Subject, Date, MIME-Version, Content-Type
 *   - Body: text/plain (UTF-8, quoted-printable)
 *   - Attachments: evaluation PDF + comparative chart PNG (base64)
 *
 * The user downloads this .eml, double-clicks it, and their email client
 * (Outlook, Thunderbird, Apple Mail, Windows Mail, etc.) opens it ready to send.
 */

interface EmlOptions {
  to: string
  cc?: string
  subject: string
  body: string
  pdfBuffer: Buffer
  pdfFilename: string
  chartBuffer: Buffer | null
  chartFilename: string
}

function rfc2822Date(d = new Date()): string {
  // Thu, 25 Sep 2026 12:00:00 +0000
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (n: number) => String(n).padStart(2, '0')
  const tzOff = -d.getTimezoneOffset()
  const sign = tzOff >= 0 ? '+' : '-'
  const tzH = pad(Math.floor(Math.abs(tzOff) / 60))
  const tzM = pad(Math.abs(tzOff) % 60)
  return `${days[d.getDay()]}, ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${tzH}${tzM}`
}

function genBoundary(): string {
  return `----=_SEMAIN_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

/** Encode header value to be safe for non-ASCII (RFC 2047 encoded-word). */
function encodeHeader(v: string): string {
  if (!v) return ''
  // ASCII-only short value: return as-is (with quotes if contains specials)
  if (/^[\x20-\x7E]+$/.test(v) && v.length < 78) {
    if (/[()<>@,;:"\\/[\]?=]/.test(v)) {
      return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return v
  }
  // Otherwise: RFC 2047 encoded-word base64
  const b64 = Buffer.from(v, 'utf-8').toString('base64')
  return `=?UTF-8?B?${b64}?=`
}

/** Encode body as quoted-printable per RFC 2045. */
function quotedPrintable(text: string): string {
  const out: string[] = []
  let lineLen = 0
  const pushChar = (ch: string) => {
    if (lineLen + ch.length > 75) {
      out.push('=\r\n')
      lineLen = 0
    }
    out.push(ch)
    lineLen += ch.length
  }
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    const ch = text[i]
    if (ch === '\n') {
      out.push('\r\n')
      lineLen = 0
      continue
    }
    if (ch === '\r') {
      // skip CR, will handle LF next iteration
      continue
    }
    if (ch === ' ' || ch === '\t') {
      // Look ahead: if end of line, must encode
      const next = text[i + 1]
      if (next === '\n' || next === '\r' || i === text.length - 1) {
        pushChar(`=${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
      } else {
        pushChar(ch)
      }
      continue
    }
    // Printable ASCII range 33-126, except '='
    if (c >= 33 && c <= 126 && ch !== '=') {
      pushChar(ch)
    } else {
      // Encode as UTF-8 bytes, then QP encode each byte
      const bytes = Buffer.from(ch, 'utf-8')
      for (const b of bytes) {
        pushChar(`=${b.toString(16).toUpperCase().padStart(2, '0')}`)
      }
    }
  }
  return out.join('')
}

function buildEml(opts: EmlOptions): string {
  const boundary = genBoundary()
  const headers: string[] = []
  // Minimal headers. No From header — Outlook will use the currently-
  // logged-in account as the sender when the user hits "Send".
  //
  // Important: NO Message-ID, NO In-Reply-To, NO References, NO Auto-Submitted,
  // NO X-Mailer, NO X-Auto-Response-Suppress. Including any of these makes
  // Outlook treat the .eml as a *received* message and present a "Reply"
  // / "Reply All" toolbar instead of the simple "Send" button. Without
  // them, Outlook opens the file as a brand-new draft ready to send.
  headers.push(`To: ${opts.to}`)
  if (opts.cc) headers.push(`Cc: ${opts.cc}`)
  headers.push(`Subject: ${encodeHeader(opts.subject)}`)
  // Date = right now. A timestamp in the past makes Outlook flag it as
  // "received earlier"; today's date keeps it looking fresh.
  headers.push(`Date: ${rfc2822Date()}`)
  headers.push(`MIME-Version: 1.0`)
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)

  const parts: string[] = []
  // Body part
  parts.push(`--${boundary}`)
  parts.push(`Content-Type: text/plain; charset=UTF-8`)
  parts.push(`Content-Transfer-Encoding: quoted-printable`)
  parts.push(`Content-Disposition: inline`)
  parts.push(``)
  parts.push(quotedPrintable(opts.body))

  // PDF attachment
  parts.push(`--${boundary}`)
  parts.push(`Content-Type: application/pdf; name="${opts.pdfFilename}"`)
  parts.push(`Content-Transfer-Encoding: base64`)
  parts.push(`Content-Disposition: attachment; filename="${opts.pdfFilename}"`)
  parts.push(``)
  parts.push(opts.pdfBuffer.toString('base64').replace(/(.{76})/g, '$1\r\n'))

  // Chart attachment (optional)
  if (opts.chartBuffer) {
    parts.push(`--${boundary}`)
    parts.push(`Content-Type: image/png; name="${opts.chartFilename}"`)
    parts.push(`Content-Transfer-Encoding: base64`)
    parts.push(`Content-Disposition: attachment; filename="${opts.chartFilename}"`)
    parts.push(``)
    parts.push(opts.chartBuffer.toString('base64').replace(/(.{76})/g, '$1\r\n'))
  }

  // Closing
  parts.push(`--${boundary}--`)
  parts.push(``)

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
2. Una gráfica comparativa que muestra la posición de ${ev.proveedor} frente a los demás proveedores evaluados.

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

  const url = new URL(req.url)
  const to = (url.searchParams.get('to') || ev.correo || '').trim()
  const subject = url.searchParams.get('subject') ||
    `Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`
  const body = url.searchParams.get('body') || buildDefaultBody(ev, ev.evaluador, ev.cargo)
  // No fromName / fromEmail — Outlook will use the currently-logged-in
  // account when the user opens the .eml. See comment in buildEml().

  // Fetch the PDF and chart PNG via internal HTTP (same-origin)
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

  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  const pdfFilename = `evaluacion-${ev.proveedor.replace(/[^\w\-]+/g, '_')}.pdf`

  let chartBuffer: Buffer | null = null
  let chartFilename = ''
  if (chartRes && chartRes.ok) {
    chartBuffer = Buffer.from(await chartRes.arrayBuffer())
    chartFilename = `grafica-${ev.proveedor.replace(/[^\w\-]+/g, '_')}.png`
  }

  const eml = buildEml({
    to,
    subject,
    body,
    pdfBuffer,
    pdfFilename,
    chartBuffer,
    chartFilename,
  })

  // Mark the evaluation as "enviado" via EML. Idempotent.
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

  const emlFilename = `evaluacion-${ev.proveedor.replace(/[^\w\-]+/g, '_')}.eml`

  return new NextResponse(eml, {
    status: 200,
    headers: {
      'Content-Type': 'message/rfc822; charset=UTF-8',
      'Content-Disposition': `attachment; filename="${emlFilename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
