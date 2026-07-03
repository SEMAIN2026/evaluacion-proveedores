import { NextRequest, NextResponse } from 'next/server'
import { db, type Evaluation } from '@/lib/db'
import nodemailer from 'nodemailer'

/**
 * POST /api/evaluations/[id]/email
 * Body: { to?: string, cc?: string, subject?: string, body?: string, attachPdf?: boolean, attachChart?: boolean }
 *
 * Sends an email via SMTP with optional PDF + chart PNG attachments.
 * Requires SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM env vars.
 *
 * If SMTP is not configured, returns 501 with a helpful message; the client
 * should fall back to the mailto: link flow.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  }

  const body = await req.json().catch(() => ({}))
  const to = (body.to || ev.correo || '').trim()
  if (!to) {
    return NextResponse.json(
      { error: 'El proveedor no tiene correo. Agrégalo y vuelve a intentarlo.' },
      { status: 400 }
    )
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser
  const smtpPort = Number(process.env.SMTP_PORT || 465)

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json(
      {
        error:
          'SMTP no configurado. Usa el botón "Abrir mi correo" o configura SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM en .env',
      },
      { status: 501 }
    )
  }

  const subject =
    body.subject ||
    `Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`

  const defaultBody = buildDefaultEmailBody(ev)
  const textBody = body.body ? String(body.body) : defaultBody.text
  const htmlBody = body.body ? `<p>${escapeHtml(String(body.body)).replace(/\n/g, '<br>')}</p>` : defaultBody.html

  // Fetch attachments (PDF + chart PNG) in parallel
  const protocol = req.nextUrl.protocol
  const host = req.headers.get('host') || 'localhost:3000'
  const baseUrl = `${protocol}//${host}`

  const attachments: nodemailer.SendMailOptions['attachments'] = []
  const wantPdf = body.attachPdf !== false
  const wantChart = body.attachChart !== false

  if (wantPdf) {
    try {
      const pdfRes = await fetch(`${baseUrl}/api/evaluations/${id}/pdf`, { cache: 'no-store' })
      if (pdfRes.ok) {
        const buf = Buffer.from(await pdfRes.arrayBuffer())
        attachments.push({
          filename: `Evaluacion-${ev.proveedor.replace(/\s+/g, '_')}.pdf`,
          content: buf,
          contentType: 'application/pdf',
        })
      }
    } catch (e) {
      console.error('PDF attachment fetch failed', e)
    }
  }
  if (wantChart) {
    try {
      const chartRes = await fetch(`${baseUrl}/api/evaluations/${id}/chart`, { cache: 'no-store' })
      if (chartRes.ok) {
        const buf = Buffer.from(await chartRes.arrayBuffer())
        attachments.push({
          filename: `Grafica-comparativa-${ev.proveedor.replace(/\s+/g, '_')}.png`,
          content: buf,
          contentType: 'image/png',
        })
      }
    } catch (e) {
      console.error('chart attachment fetch failed', e)
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      cc: body.cc,
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    })
    return NextResponse.json({ ok: true, messageId: info.messageId, to })
  } catch (e) {
    console.error('SMTP send failed', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'SMTP error' },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildDefaultEmailBody(ev: Evaluation): { text: string; html: string } {
  const text = `Estimado equipo de ${ev.proveedor},

Les compartimos los resultados de la evaluación de desempeño como proveedor, realizada el ${formatDate(ev.fecha)}.

RESUMEN DE LA EVALUACIÓN
- Proveedor: ${ev.proveedor}
- Calificación final: ${ev.calificacion.toFixed(1)} / 100
- Clasificación: ${ev.clasificacion}
- Total de puntos: ${ev.total} / 40

Les adjuntamos:
1. El reporte completo en PDF con el detalle por criterio.
2. Una gráfica comparativa que muestra la posición de ${ev.proveedor} frente a los demás proveedores evaluados.

${observationsText(ev)}

Quedamos atentos a sus comentarios y a continuar trabajando en la mejora continua.

Saludos cordiales,
${ev.evaluador}
${ev.cargo}
`

  const html = `<div style="font-family: Inter, Arial, sans-serif; color: #0f172a; max-width: 640px;">
  <p>Estimado equipo de <strong>${escapeHtml(ev.proveedor)}</strong>,</p>
  <p>Les compartimos los resultados de la evaluación de desempeño como proveedor, realizada el <strong>${formatDate(ev.fecha)}</strong>.</p>
  <div style="background:#f1f5f9; padding:14px 18px; border-radius:8px; border-left:4px solid #0ea5e9; margin:14px 0;">
    <div style="font-size:13px; color:#475569; font-weight:600; letter-spacing:0.5px; margin-bottom:6px;">RESUMEN DE LA EVALUACIÓN</div>
    <table style="font-size:14px; line-height:1.7;">
      <tr><td style="color:#64748b; padding-right:14px;">Proveedor:</td><td><strong>${escapeHtml(ev.proveedor)}</strong></td></tr>
      <tr><td style="color:#64748b;">Calificación final:</td><td><strong style="color:#0f172a;">${ev.calificacion.toFixed(1)} / 100</strong></td></tr>
      <tr><td style="color:#64748b;">Clasificación:</td><td><strong style="color:${classColor(ev.clasificacion)};">${ev.clasificacion}</strong></td></tr>
      <tr><td style="color:#64748b;">Total de puntos:</td><td><strong>${ev.total} / 40</strong></td></tr>
    </table>
  </div>
  <p>Les adjuntamos:</p>
  <ol>
    <li>El reporte completo en <strong>PDF</strong> con el detalle por criterio.</li>
    <li>Una <strong>gráfica comparativa</strong> que muestra la posición de ${escapeHtml(ev.proveedor)} frente a los demás proveedores evaluados.</li>
  </ol>
  ${observationsHtml(ev)}
  <p>Quedamos atentos a sus comentarios y a continuar trabajando en la mejora continua.</p>
  <p style="margin-top:24px;">Saludos cordiales,<br/>
    <strong>${escapeHtml(ev.evaluador)}</strong><br/>
    <span style="color:#64748b;">${escapeHtml(ev.cargo)}</span>
  </p>
</div>`

  return { text, html }
}

function observationsText(ev: Evaluation): string {
  if (!ev.observaciones || ev.observaciones.trim() === '') {
    return 'Observaciones: SIN OBSERVACIONES.'
  }
  return `Observaciones:\n${ev.observaciones}`
}

function observationsHtml(ev: Evaluation): string {
  if (!ev.observaciones || ev.observaciones.trim() === '') {
    return ''
  }
  return `<div style="background:#fffbeb; padding:12px 14px; border-radius:6px; border-left:4px solid #f59e0b; margin:14px 0;">
    <div style="font-size:12px; color:#92400e; font-weight:600; margin-bottom:4px;">OBSERVACIONES</div>
    <div style="font-size:13px; color:#451a03;">${escapeHtml(ev.observaciones).replace(/\n/g, '<br>')}</div>
  </div>`
}

function classColor(c: string): string {
  switch (c) {
    case 'EXCELENTE': return '#10b981'
    case 'BUENO': return '#0ea5e9'
    case 'REGULAR': return '#f59e0b'
    case 'MALO': return '#f43f5e'
    default: return '#64748b'
  }
}

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}
