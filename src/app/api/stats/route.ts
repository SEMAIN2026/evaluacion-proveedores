import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const total = await db.execute(`SELECT COUNT(*) AS c FROM evaluations`)
    const totalCount = Number(total.rows[0]?.c ?? 0)

    const byClass = await db.execute(
      `SELECT clasificacion, COUNT(*) AS c, AVG(calificacion) AS avg
       FROM evaluations GROUP BY clasificacion`
    )
    const distribution: Record<string, { count: number; avg: number }> = {}
    for (const row of byClass.rows) {
      distribution[String(row.clasificacion)] = {
        count: Number(row.c ?? 0),
        avg: Number(row.avg ?? 0),
      }
    }

    const avgRow = await db.execute(`SELECT AVG(calificacion) AS avg, MAX(calificacion) AS max, MIN(calificacion) AS min FROM evaluations`)
    const avg = Number(avgRow.rows[0]?.avg ?? 0)
    const max = Number(avgRow.rows[0]?.max ?? 0)
    const min = Number(avgRow.rows[0]?.min ?? 0)

    const top5 = await db.execute(
      `SELECT id, proveedor, calificacion, clasificacion, fecha
       FROM evaluations ORDER BY calificacion DESC, created_at ASC LIMIT 5`
    )
    const bottom5 = await db.execute(
      `SELECT id, proveedor, calificacion, clasificacion, fecha
       FROM evaluations ORDER BY calificacion ASC, created_at ASC LIMIT 5`
    )

    const withEmail = await db.execute(
      `SELECT COUNT(*) AS c FROM evaluations WHERE correo IS NOT NULL AND correo != ''`
    )
    const withEmailCount = Number(withEmail.rows[0]?.c ?? 0)

    return NextResponse.json({
      data: {
        total: totalCount,
        average: avg,
        max,
        min,
        distribution,
        top5: top5.rows,
        bottom5: bottom5.rows,
        withEmail: withEmailCount,
        withoutEmail: totalCount - withEmailCount,
      },
    })
  } catch (e) {
    console.error('GET /api/stats error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }
}
