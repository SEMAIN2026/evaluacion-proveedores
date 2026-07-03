import { NextRequest, NextResponse } from 'next/server'
import { db, CRITERIA, classify, type Evaluation } from '@/lib/db'

function genId(): string {
  const d = new Date()
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8)
  return `eval-${ymd}-${rand}`
}

export async function GET() {
  try {
    const res = await db.execute(
      `SELECT * FROM evaluations ORDER BY datetime(fecha) DESC, created_at DESC`
    )
    const rows = res.rows.map((r) => ({
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
    })) as Evaluation[]
    return NextResponse.json({ data: rows })
  } catch (e) {
    console.error('GET /api/evaluations error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const proveedor = String(body.proveedor ?? '').trim()
    if (!proveedor) {
      return NextResponse.json({ error: 'proveedor es requerido' }, { status: 400 })
    }

    const correo = body.correo ? String(body.correo).trim() : null
    const fecha = body.fecha ? String(body.fecha) : new Date().toISOString().slice(0, 10)

    const scores: Record<string, number> = {}
    let total = 0
    for (const c of CRITERIA) {
      const v = Math.max(0, Math.min(4, Number(body[c.key] ?? 0)))
      scores[c.key] = v
      total += v
    }
    const calificacion = (total / 40) * 100
    const clasificacion = classify(calificacion)
    const observaciones = body.observaciones ? String(body.observaciones) : ''
    const evaluador = body.evaluador
      ? String(body.evaluador)
      : process.env.EVALUADOR_NOMBRE || 'Walter Piñera'
    const cargo = body.cargo
      ? String(body.cargo)
      : process.env.EVALUADOR_CARGO || 'Ingeniero Calidad y Compras'

    const id = body.id ? String(body.id) : genId()
    const now = Date.now()

    await db.execute({
      sql: `INSERT INTO evaluations
        (id, proveedor, correo, fecha, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10,
         total, calificacion, clasificacion, observaciones, evaluador, cargo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          proveedor=excluded.proveedor,
          correo=excluded.correo,
          fecha=excluded.fecha,
          c1=excluded.c1, c2=excluded.c2, c3=excluded.c3, c4=excluded.c4,
          c5=excluded.c5, c6=excluded.c6, c7=excluded.c7, c8=excluded.c8,
          c9=excluded.c9, c10=excluded.c10,
          total=excluded.total,
          calificacion=excluded.calificacion,
          clasificacion=excluded.clasificacion,
          observaciones=excluded.observaciones,
          evaluador=excluded.evaluador,
          cargo=excluded.cargo,
          updated_at=excluded.updated_at
      `,
      args: [
        id, proveedor, correo, fecha,
        scores.c1, scores.c2, scores.c3, scores.c4, scores.c5,
        scores.c6, scores.c7, scores.c8, scores.c9, scores.c10,
        total, calificacion, clasificacion, observaciones, evaluador, cargo, now, now,
      ],
    })

    return NextResponse.json({
      data: {
        id,
        proveedor,
        correo,
        fecha,
        ...scores,
        total,
        calificacion,
        clasificacion,
        observaciones,
        evaluador,
        cargo,
        created_at: now,
        updated_at: now,
      },
    })
  } catch (e) {
    console.error('POST /api/evaluations error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
