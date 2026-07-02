import { NextRequest, NextResponse } from 'next/server'
import { db, CRITERIA, type Evaluation } from '@/lib/db'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReactElement } from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'

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

  // Fetch the chart PNG (call internal API route URL)
  const protocol = req.nextUrl.protocol
  const host = req.headers.get('host') || 'localhost:3000'
  const chartUrl = `${protocol}//${host}/api/evaluations/${id}/chart`
  let chartBase64: string | null = null
  try {
    const chartRes = await fetch(chartUrl, { cache: 'no-store' })
    if (chartRes.ok) {
      const buf = Buffer.from(await chartRes.arrayBuffer())
      chartBase64 = `data:image/png;base64,${buf.toString('base64')}`
    }
  } catch (e) {
    console.error('chart fetch failed for PDF', e)
  }

  const pdfBuffer = await renderToBuffer(PdfDocument({ ev, chartBase64 }))

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="evaluacion-${ev.proveedor.replace(/\s+/g, '_')}.pdf"`,
    },
  })
}

function PdfDocument({
  ev,
  chartBase64,
}: {
  ev: Evaluation
  chartBase64: string | null
}): ReactElement {
  const fechaFmt = formatDate(ev.fecha)

  const scores = [
    ev.c1, ev.c2, ev.c3, ev.c4, ev.c5,
    ev.c6, ev.c7, ev.c8, ev.c9, ev.c10,
  ]

  return (
    <Document
      title={`Evaluación ${ev.proveedor}`}
      author={ev.evaluador}
      subject="Evaluación de Proveedores"
      creator="Z.ai - Sistema de Evaluación de Proveedores"
    >
      <Page size="A4" style={styles.page}>
        {/* Header band */}
        <View style={styles.headerBand}>
          <Text style={styles.headerTitle}>EVALUACIÓN DE PROVEEDORES</Text>
          <Text style={styles.headerCode}>F-CAL-07 REV01</Text>
          <Text style={styles.headerDate}>{fechaFmt}</Text>
        </View>

        {/* Supplier info */}
        <View style={styles.infoBlock}>
          <InfoRow label="NOMBRE DEL PROVEEDOR" value={ev.proveedor.toUpperCase()} />
          <InfoRow label="CORREO ELECTRÓNICO" value={ev.correo || '—'} />
          <InfoRow label="FECHA DE EVALUACIÓN" value={fechaFmt} />
        </View>

        <View style={styles.scoreInfoRow}>
          <Text style={styles.scoreInfoText}>
            SISTEMA DE PUNTUACIÓN: Malo=1 · Regular=2 · Bien=3 · Excelente=4
          </Text>
        </View>

        {/* Criteria table */}
        <View style={styles.tableHeader}>
          <Text style={styles.tableCol1}>Criterio a evaluar</Text>
          <Text style={styles.tableCol2}>Calificación</Text>
        </View>
        {CRITERIA.map((c, i) => (
          <View key={c.key} style={i % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
            <Text style={styles.tableCol1}>{c.label}</Text>
            <Text style={styles.tableCol2}>
              {scores[i]} — {scoreLabel(scores[i])}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Total de puntos obtenidos:</Text>
          <Text style={styles.totalsValue}>{ev.total}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Total de puntos posibles:</Text>
          <Text style={styles.totalsValue}>40</Text>
        </View>
        <View style={styles.evaluationRow}>
          <Text style={styles.evaluationLabel}>Evaluación del proveedor =</Text>
          <Text style={styles.evaluationValue}>
            {ev.calificacion.toFixed(1)} · {ev.clasificacion}
          </Text>
        </View>

        {/* Classification legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><Text style={[styles.legendSwatch, { backgroundColor: '#10b981' }]} /><Text style={styles.legendText}>EXCELENTE 91-100</Text></View>
          <View style={styles.legendItem}><Text style={[styles.legendSwatch, { backgroundColor: '#0ea5e9' }]} /><Text style={styles.legendText}>BUENO 71-90</Text></View>
          <View style={styles.legendItem}><Text style={[styles.legendSwatch, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legendText}>REGULAR 51-70</Text></View>
          <View style={styles.legendItem}><Text style={[styles.legendSwatch, { backgroundColor: '#f43f5e' }]} /><Text style={styles.legendText}>MALO 0-50</Text></View>
        </View>

        {/* Observations */}
        <Text style={styles.obsTitle}>Observaciones:</Text>
        <View style={styles.obsBox}>
          <Text style={styles.obsText}>{ev.observaciones || 'SIN OBSERVACIONES.'}</Text>
        </View>

        {/* Comparison chart */}
        {chartBase64 && (
          <View style={styles.chartBlock}>
            <Text style={styles.chartTitle}>POSICIÓN COMPARATIVA ENTRE PROVEEDORES</Text>
            <Image source={chartBase64} style={styles.chartImage} alt="Gráfica comparativa de proveedores" />
          </View>
        )}

        {/* Evaluator signature */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureCol}>
            <Text style={styles.sigLabel}>Nombre del evaluador</Text>
            <Text style={styles.sigValue}>{ev.evaluador}</Text>
            <View style={styles.sigLine} />
          </View>
          <View style={styles.signatureCol}>
            <Text style={styles.sigLabel}>Firma</Text>
            <View style={styles.sigLine} />
          </View>
          <View style={styles.signatureCol}>
            <Text style={styles.sigLabel}>Cargo</Text>
            <Text style={styles.sigValue}>{ev.cargo}</Text>
            <View style={styles.sigLine} />
          </View>
        </View>

        <Text style={styles.footer} fixed>
          F-CAL-07 REV01 · Documento generado por Sistema de Evaluación de Proveedores
        </Text>
      </Page>
    </Document>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function scoreLabel(v: number): string {
  if (v === 1) return 'Malo'
  if (v === 2) return 'Regular'
  if (v === 3) return 'Bien'
  if (v === 4) return 'Excelente'
  return '—'
}

function formatDate(s: string): string {
  // Accept YYYY-MM-DD or DD/MM/YYYY or ISO. Output DD/MM/YYYY.
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  headerBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 6,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  headerCode: {
    fontSize: 10,
    color: '#475569',
    fontWeight: 'bold',
  },
  headerDate: {
    fontSize: 9,
    color: '#64748b',
  },
  infoBlock: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    width: 180,
    fontSize: 10,
    color: '#475569',
    fontWeight: 'bold',
  },
  infoValue: {
    flex: 1,
    fontSize: 10,
    color: '#0f172a',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 1,
  },
  scoreInfoRow: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 10,
  },
  scoreInfoText: {
    fontSize: 9,
    color: '#334155',
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tableCol1: {
    flex: 1,
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  tableCol2: {
    width: 160,
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  totalsLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalsValue: {
    width: 160,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  evaluationRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fef3c7',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: 10,
  },
  evaluationLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
  },
  evaluationValue: {
    width: 160,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    marginRight: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    color: '#475569',
    fontWeight: 'bold',
  },
  obsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#0f172a',
  },
  obsBox: {
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    padding: 8,
    minHeight: 50,
    marginBottom: 14,
  },
  obsText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.4,
  },
  chartBlock: {
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  chartImage: {
    width: '100%',
    height: 170,
    objectFit: 'contain',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    borderRadius: 3,
  },
  signatureBlock: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  signatureCol: {
    flex: 1,
  },
  sigLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 22,
  },
  sigValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 22,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
