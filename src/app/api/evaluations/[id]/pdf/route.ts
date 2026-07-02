import { NextRequest, NextResponse } from 'next/server'
import { db, type Evaluation } from '@/lib/db'
import { spawn } from 'child_process'
import { writeFile, readFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function GET(
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

  // Optionally include the chart on a 2nd page (only when ?withChart=1)
  const url = new URL(req.url)
  const withChart = url.searchParams.get('withChart') === '1'

  // Paths
  const scriptsDir = process.cwd() + '/scripts'
  const generatorScript = join(scriptsDir, 'pdf_generator.py')
  // Use cwd-based assets so it works on Vercel too
  const assetsDir = process.cwd() + '/public/assets'
  const logoPath = join(assetsDir, 'logo.png')
  const signaturePath = join(assetsDir, 'firma-evaluador.png')

  // Work in /tmp (serverless-safe)
  const workDir = join(tmpdir(), `evalpdf-${id}-${Date.now()}`)
  await mkdir(workDir, { recursive: true })
  const outPdf = join(workDir, 'evaluacion.pdf')
  const evJsonPath = join(workDir, 'ev.json')
  const chartPath = join(workDir, 'chart.png')

  await writeFile(evJsonPath, JSON.stringify(ev))

  let chartDownloaded = false
  if (withChart) {
    try {
      const protocol = req.nextUrl.protocol
      const host = req.headers.get('host') || 'localhost:3000'
      const chartUrl = `${protocol}//${host}/api/evaluations/${id}/chart`
      const chartRes = await fetch(chartUrl, { cache: 'no-store' })
      if (chartRes.ok) {
        const buf = Buffer.from(await chartRes.arrayBuffer())
        await writeFile(chartPath, buf)
        chartDownloaded = true
      }
    } catch (e) {
      console.error('chart fetch failed for PDF', e)
    }
  }

  // Build args for the python script
  const args = [
    generatorScript,
    evJsonPath,
    outPdf,
    chartDownloaded ? chartPath : '__NO_CHART__',
    logoPath,
    signaturePath,
  ]

  try {
    await runPython(args)
  } catch (e) {
    console.error('python pdf generation failed', e)
    // Fallback: try without chart
    if (chartDownloaded) {
      await runPython([generatorScript, evJsonPath, outPdf, '__NO_CHART__', logoPath, signaturePath])
    } else {
      throw e
    }
  }

  if (!existsSync(outPdf)) {
    return NextResponse.json({ error: 'PDF no generado' }, { status: 500 })
  }

  const buf = await readFile(outPdf)
  // Cleanup
  try {
    await unlink(outPdf)
    await unlink(evJsonPath)
    if (chartDownloaded) await unlink(chartPath)
    await import('fs').then((fs) => fs.rmdirSync(workDir))
  } catch {}

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="evaluacion-${ev.proveedor.replace(/\s+/g, '_')}.pdf"`,
    },
  })
}

function runPython(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`python exited ${code}: ${stderr}`))
    })
  })
}
