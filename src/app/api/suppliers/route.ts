import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema, type Supplier } from '@/lib/db'

function genSupplierId(): string {
  return `sup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * GET /api/suppliers[?q=<prefix>]
 * Returns the list of all known suppliers (id, nombre, correo, telefono,
 * evaluaciones_count, ultima_evaluacion) ordered by most recently used.
 *
 * If `?q=` is provided, filters by case-insensitive prefix on nombre.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureSchema()
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    let sql = `SELECT id, nombre, correo, telefono, evaluaciones_count, ultima_evaluacion
               FROM suppliers`
    const args: string[] = []
    if (q) {
      sql += ` WHERE nombre LIKE ? COLLATE NOCASE`
      args.push(`${q}%`)
    }
    sql += ` ORDER BY ultima_evaluacion DESC, nombre ASC LIMIT 200`
    const res = await db.execute({ sql, args })
    const rows = res.rows.map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre ?? ''),
      correo: r.correo ? String(r.correo) : null,
      telefono: r.telefono ? String(r.telefono) : null,
      evaluaciones_count: Number(r.evaluaciones_count ?? 0),
      ultima_evaluacion: r.ultima_evaluacion ? String(r.ultima_evaluacion) : null,
    })) as Supplier[]
    return NextResponse.json({ data: rows })
  } catch (e) {
    console.error('GET /api/suppliers error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers
 * Body: { nombre: string, correo?: string, telefono?: string }
 * Upserts a supplier keyed by `nombre`. Useful for pre-registering a supplier
 * before any evaluation is filed for them.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureSchema()
    const body = await req.json()
    const nombre = String(body.nombre ?? '').trim()
    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }
    const correo = body.correo ? String(body.correo).trim() : null
    const telefono = body.telefono ? String(body.telefono).trim() : null
    const now = Date.now()

    await db.execute({
      sql: `INSERT INTO suppliers (id, nombre, correo, telefono, evaluaciones_count, ultima_evaluacion, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, NULL, ?, ?)
            ON CONFLICT(nombre) DO UPDATE SET
              correo = COALESCE(NULLIF(excluded.correo, ''), suppliers.correo),
              telefono = COALESCE(NULLIF(excluded.telefono, ''), suppliers.telefono),
              updated_at = excluded.updated_at`,
      args: [genSupplierId(), nombre, correo, telefono, now, now],
    })

    const res = await db.execute({
      sql: `SELECT id, nombre, correo, telefono, evaluaciones_count, ultima_evaluacion
            FROM suppliers WHERE nombre = ? LIMIT 1`,
      args: [nombre],
    })
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'upsert falló' }, { status: 500 })
    }
    const r = res.rows[0]
    return NextResponse.json({
      data: {
        id: String(r.id),
        nombre: String(r.nombre ?? ''),
        correo: r.correo ? String(r.correo) : null,
        telefono: r.telefono ? String(r.telefono) : null,
        evaluaciones_count: Number(r.evaluaciones_count ?? 0),
        ultima_evaluacion: r.ultima_evaluacion ? String(r.ultima_evaluacion) : null,
      },
    })
  } catch (e) {
    console.error('POST /api/suppliers error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
