import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// F-COM-19 scoring logic
// 4 criteria with weighted scores

interface SelectionInput {
  proveedor: string
  fecha: string
  evaluador?: string
  cotizacion_tiempo?: string  // '1-5' | '6-15' | '>15'
  inconformidad_tiempo?: string  // '1-3' | '4-8' | '>8' | 'no'
  entrega_tiempo?: string  // 'justo' | '1-7' | '8-15' | '>15'
  cantidad_entregada?: string  // 'exacta' | 'faltante_justificado' | 'faltante_injustificado'
  especificaciones?: string  // 'cumple' | 'no_cumple'
  calidad_precio?: string  // 'mayor_menor' | 'mayor_mayor' | 'menor_mayor' | 'menor_menor'
  requisitos_legales?: string  // 'cumple' | 'no_cumple'
  iso_9001?: string  // 'SI' | 'NO'
  observaciones?: string
  id?: string
}

// Score lookup tables (from the F-COM-19 document)
const SCORES = {
  cotizacion: { '1-5': 10, '6-15': 6, '>15': 1 },
  inconformidad: { '1-3': 10, '4-8': 7, '>8': 5, 'no': 1 },
  entrega: { 'justo': 10, '1-7': 7, '8-15': 5, '>15': 1 },
  cantidad: { 'exacta': 10, 'faltante_justificado': 6, 'faltante_injustificado': 1 },
  especificaciones: { 'cumple': 10, 'no_cumple': 1 },
  calidad_precio: { 'mayor_menor': 10, 'mayor_mayor': 7, 'menor_mayor': 5, 'menor_menor': 1 },
  requisitos_legales: { 'cumple': 10, 'no_cumple': 1 },
}

// Weights (from the document)
// CAPACIDAD DE RESPUESTA: 25% (cotizacion 50% + inconformidad 50%)
// ENTREGA DE BIENES: 40% (entrega 50% + cantidad 50%)
// CUMPLIMIENTO DE REQUISITOS: 35% (especificaciones 35% + calidad_precio 35% + legales 30%)
// ISO 9001: bonus info (not in weighted score directly)

function calculateScore(input: SelectionInput): { score: number; desempeno: string } {
  // Capacidad de respuesta (25%)
  const cotScore = SCORES.cotizacion[input.cotizacion_tiempo as keyof typeof SCORES.cotizacion] ?? 0
  const incScore = SCORES.inconformidad[input.inconformidad_tiempo as keyof typeof SCORES.inconformidad] ?? 0
  const capacidad = (cotScore * 0.5 + incScore * 0.5) // 0-10

  // Entrega de bienes (40%)
  const entScore = SCORES.entrega[input.entrega_tiempo as keyof typeof SCORES.entrega] ?? 0
  const cantScore = SCORES.cantidad[input.cantidad_entregada as keyof typeof SCORES.cantidad] ?? 0
  const entregaBienes = (entScore * 0.5 + cantScore * 0.5) // 0-10

  // Cumplimiento de requisitos (35%)
  const espScore = SCORES.especificaciones[input.especificaciones as keyof typeof SCORES.especificaciones] ?? 0
  const calScore = SCORES.calidad_precio[input.calidad_precio as keyof typeof SCORES.calidad_precio] ?? 0
  const legScore = SCORES.requisitos_legales[input.requisitos_legales as keyof typeof SCORES.requisitos_legales] ?? 0
  const cumplimiento = (espScore * 0.35 + calScore * 0.35 + legScore * 0.30) // 0-10

  // Weighted total (0-10 scale)
  const total = (capacidad * 0.25 + entregaBienes * 0.40 + cumplimiento * 0.35)

  // Desempeño classification (from the document)
  let desempeno = ''
  if (total >= 9) desempeno = 'DESEMPEÑO NOTABLE'
  else if (total >= 8) desempeno = 'DESEMPEÑO CONFIABLE'
  else if (total >= 7) desempeno = 'DESEMPEÑO RIESGOSO'
  else desempeno = 'DESEMPEÑO CRÍTICO'

  return { score: Math.round(total * 100) / 100, desempeno }
}

function genId(): string {
  const d = new Date()
  const ymd = d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8)
  return `sel-${ymd}-${rand}`
}

export async function GET() {
  try {
    const res = await db.execute(
      `SELECT * FROM supplier_selections ORDER BY datetime(fecha) DESC, created_at DESC`
    )
    const rows = res.rows.map((r) => ({
      id: String(r.id),
      proveedor: String(r.proveedor ?? ''),
      fecha: String(r.fecha ?? ''),
      evaluador: String(r.evaluador ?? 'Walter Piñera'),
      cotizacion_tiempo: String(r.cotizacion_tiempo ?? ''),
      inconformidad_tiempo: String(r.inconformidad_tiempo ?? ''),
      entrega_tiempo: String(r.entrega_tiempo ?? ''),
      cantidad_entregada: String(r.cantidad_entregada ?? ''),
      especificaciones: String(r.especificaciones ?? ''),
      calidad_precio: String(r.calidad_precio ?? ''),
      requisitos_legales: String(r.requisitos_legales ?? ''),
      iso_9001: String(r.iso_9001 ?? 'NO'),
      calificacion: Number(r.calificacion ?? 0),
      desempeno: String(r.desempeno ?? ''),
      observaciones: String(r.observaciones ?? ''),
      created_at: Number(r.created_at ?? 0),
      updated_at: Number(r.updated_at ?? 0),
    }))
    return NextResponse.json({ data: rows })
  } catch (e) {
    console.error('GET /api/selections error', e)
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

    const input: SelectionInput = {
      proveedor,
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      evaluador: body.evaluador || 'Walter Piñera',
      cotizacion_tiempo: body.cotizacion_tiempo || '',
      inconformidad_tiempo: body.inconformidad_tiempo || '',
      entrega_tiempo: body.entrega_tiempo || '',
      cantidad_entregada: body.cantidad_entregada || '',
      especificaciones: body.especificaciones || '',
      calidad_precio: body.calidad_precio || '',
      requisitos_legales: body.requisitos_legales || '',
      iso_9001: body.iso_9001 || 'NO',
      observaciones: body.observaciones || '',
    }

    const { score, desempeno } = calculateScore(input)

    const id = body.id ? String(body.id) : genId()
    const now = Date.now()

    await db.execute({
      sql: `INSERT INTO supplier_selections
        (id, proveedor, fecha, evaluador,
         cotizacion_tiempo, inconformidad_tiempo,
         entrega_tiempo, cantidad_entregada,
         especificaciones, calidad_precio, requisitos_legales,
         iso_9001, calificacion, desempeno, observaciones,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          proveedor=excluded.proveedor,
          fecha=excluded.fecha,
          evaluador=excluded.evaluador,
          cotizacion_tiempo=excluded.cotizacion_tiempo,
          inconformidad_tiempo=excluded.inconformidad_tiempo,
          entrega_tiempo=excluded.entrega_tiempo,
          cantidad_entregada=excluded.cantidad_entregada,
          especificaciones=excluded.especificaciones,
          calidad_precio=excluded.calidad_precio,
          requisitos_legales=excluded.requisitos_legales,
          iso_9001=excluded.iso_9001,
          calificacion=excluded.calificacion,
          desempeno=excluded.desempeno,
          observaciones=excluded.observaciones,
          updated_at=excluded.updated_at
      `,
      args: [
        id, input.proveedor, input.fecha, input.evaluador,
        input.cotizacion_tiempo, input.inconformidad_tiempo,
        input.entrega_tiempo, input.cantidad_entregada,
        input.especificaciones, input.calidad_precio, input.requisitos_legales,
        input.iso_9001, score, desempeno, input.observaciones,
        now, now,
      ],
    })

    return NextResponse.json({
      data: { id, ...input, calificacion: score, desempeno, created_at: now, updated_at: now },
    })
  } catch (e) {
    console.error('POST /api/selections error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }
  await db.execute({ sql: `DELETE FROM supplier_selections WHERE id = ?`, args: [id] })
  return NextResponse.json({ ok: true })
}
