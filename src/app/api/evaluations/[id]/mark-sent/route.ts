import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'

/**
 * POST /api/evaluations/[id]/mark-sent
 * Body: { tipo: 'EML' | 'WHATSAPP' }
 *
 * Marks the evaluation as "enviado" with the given channel type and the
 * current timestamp. The user can call this either:
 *   - automatically, from the email-modal when they download an EML or
 *     open WhatsApp, OR
 *   - manually, from a "Marcar como enviado" button on the provider card.
 *
 * The mark is idempotent: re-marking the same evaluation just updates the
 * timestamp and the tipo (so the latest channel used wins).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema()
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const tipoRaw = String(body.tipo || '').trim().toUpperCase()
  if (tipoRaw !== 'EML' && tipoRaw !== 'WHATSAPP') {
    return NextResponse.json(
      { error: "tipo es requerido y debe ser 'EML' o 'WHATSAPP'" },
      { status: 400 }
    )
  }

  const now = Date.now()
  try {
    const res = await db.execute({
      sql: `UPDATE evaluations
            SET enviado = 1,
                enviado_tipo = ?,
                enviado_fecha = ?,
                updated_at = ?
            WHERE id = ?`,
      args: [tipoRaw, now, now, id],
    })
    if (res.rowsAffected === 0) {
      // libsql sometimes returns 0 even when the row exists; double-check by
      // querying the row. If it really doesn't exist, return 404.
      const check = await db.execute({
        sql: `SELECT 1 FROM evaluations WHERE id = ? LIMIT 1`,
        args: [id],
      })
      if (check.rows.length === 0) {
        return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
      }
    }
    return NextResponse.json({
      ok: true,
      data: {
        id,
        enviado: 1,
        enviado_tipo: tipoRaw,
        enviado_fecha: now,
      },
    })
  } catch (e) {
    console.error('POST /api/evaluations/[id]/mark-sent error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
