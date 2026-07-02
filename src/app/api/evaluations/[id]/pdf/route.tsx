import { NextRequest, NextResponse } from 'next/server'
import { db, type Evaluation } from '@/lib/db'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReactElement } from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image as PdfImage,
  Canvas,
} from '@react-pdf/renderer'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Read logo and signature as base64 once (cached at module load)
async function loadAsset(rel: string): Promise<string | null> {
  try {
    const p = join(process.cwd(), 'public', rel)
    const buf = await readFile(p)
    const ext = rel.split('.').pop()?.toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

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

  const url = new URL(req.url)
  const withChart = url.searchParams.get('withChart') === '1'

  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    loadAsset('assets/logo.png'),
    loadAsset('assets/firma-evaluador.png'),
  ])

  let chartDataUrl: string | null = null
  if (withChart) {
    try {
      const protocol = req.nextUrl.protocol
      const host = req.headers.get('host') || 'localhost:3000'
      const chartUrl = `${protocol}//${host}/api/evaluations/${id}/chart`
      const chartRes = await fetch(chartUrl, { cache: 'no-store' })
      if (chartRes.ok) {
        const buf = Buffer.from(await chartRes.arrayBuffer())
        chartDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      console.error('chart fetch failed for PDF', e)
    }
  }

  const pdfBuffer = await renderToBuffer(
    PdfDocument({ ev, logoDataUrl, signatureDataUrl, chartDataUrl })
  )

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="evaluacion-${ev.proveedor.replace(/\s+/g, '_')}.pdf"`,
    },
  })
}

// ============== Constants matching the original F-CAL-07 sample ==============
// A4 portrait: 595.28 x 841.89 pt
const PAGE_W = 595.28
const PAGE_H = 841.89

// Layout constants (from sample PDF inspection)
const M_LEFT = 44.5
const M_RIGHT = 543.08
const CONTENT_W = M_RIGHT - M_LEFT
const COL1_RIGHT = 254.13
const COL2_RIGHT = 460.68

// Colors
const LIGHT_BLUE = '#DDEBFB'
const DARK_GREEN = '#00B050'
const LIGHT_GREEN = '#92D050'
const ORANGE = '#FFC000'
const RED = '#FF0000'
const BLACK = '#000000'
const WHITE = '#FFFFFF'
const GRAY = '#808080'

interface PdfDocProps {
  ev: Evaluation
  logoDataUrl: string | null
  signatureDataUrl: string | null
  chartDataUrl: string | null
}

function PdfDocument({ ev, logoDataUrl, signatureDataUrl, chartDataUrl }: PdfDocProps): ReactElement {
  const proveedor = (ev.proveedor || '').toUpperCase()
  const correo = (ev.correo || '').toUpperCase()
  const fecha = formatDate(ev.fecha)
  const calificacion = Number(ev.calificacion)
  const clasificacion = ev.clasificacion
  const clsColor =
    clasificacion === 'EXCELENTE' ? DARK_GREEN :
    clasificacion === 'BUENO' ? LIGHT_GREEN :
    clasificacion === 'REGULAR' ? ORANGE :
    RED
  const clsTextColor = (clasificacion === 'EXCELENTE' || clasificacion === 'MALO') ? WHITE : BLACK

  const scores = [ev.c1, ev.c2, ev.c3, ev.c4, ev.c5, ev.c6, ev.c7, ev.c8, ev.c9, ev.c10]
  const criteria = [
    'Calidad del producto',
    'Relación precio-calidad',
    'Material en stock',
    'Posibilidad de devolución del producto',
    'Servicio (velocidad de respuesta)',
    'Cumplimiento de fecha de entrega',
    'Servicio post-venta',
    'Pago del transporte',
    'Amabilidad de venta',
    'Envío de material completo',
  ]

  // Convert PDF bottom-left origin to top-left for @react-pdf (which uses top-left)
  // y_top = PAGE_H - y_bottom
  const yTop = (yBottom: number) => PAGE_H - yBottom

  return (
    <Document
      title={`Evaluación ${ev.proveedor}`}
      author={ev.evaluador}
      subject="Evaluación de Proveedores F-CAL-07 REV01"
      creator="Sistema de Evaluación de Proveedores"
    >
      <Page
        size={[PAGE_W, PAGE_H]}
        style={{ margin: 0, padding: 0, position: 'relative' }}
      >
        {/* ============== 1. HEADER BAND (y=22 to y=74.3) ============== */}
        {/* 3-column background */}
        <View
          style={{
            position: 'absolute',
            left: M_LEFT,
            top: yTop(74.3),
            width: COL1_RIGHT - M_LEFT,
            height: 52.3,
            backgroundColor: WHITE,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: COL1_RIGHT,
            top: yTop(74.3),
            width: COL2_RIGHT - COL1_RIGHT,
            height: 52.3,
            backgroundColor: LIGHT_BLUE,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: COL2_RIGHT,
            top: yTop(74.3),
            width: M_RIGHT - COL2_RIGHT,
            height: 52.3,
            backgroundColor: LIGHT_BLUE,
          }}
        />

        {/* Logo (left column, centered) */}
        {logoDataUrl && (
          <PdfImage
            src={logoDataUrl}
            style={{
              position: 'absolute',
              left: M_LEFT + 4,
              top: yTop(70),
              width: COL1_RIGHT - M_LEFT - 8,
              height: 44,
              objectFit: 'contain',
            }}
          />
        )}

        {/* Title (middle column, centered) - sized to fit Helvetica-Bold */}
        <Text
          style={{
            position: 'absolute',
            left: COL1_RIGHT,
            top: yTop(56),
            width: COL2_RIGHT - COL1_RIGHT,
            textAlign: 'center',
            fontFamily: 'Helvetica-Bold',
            fontSize: 11,
            color: BLACK,
          }}
        >
          EVALUACIÓN DE PROVEEDORES
        </Text>

        {/* Code & date (right column) */}
        <Text
          style={{
            position: 'absolute',
            left: 475.9,
            top: yTop(56),
            fontFamily: 'Helvetica',
            fontSize: 8,
            color: BLACK,
          }}
        >
          F-CAL-07 REV01
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 475.9,
            top: yTop(45),
            fontFamily: 'Helvetica',
            fontSize: 8,
            color: BLACK,
          }}
        >
          05/07/2021
        </Text>

        {/* Black vertical separators (header) */}
        {[M_LEFT, COL1_RIGHT, COL2_RIGHT, M_RIGHT].map((x, i) => (
          <View
            key={`hdr-sep-${i}`}
            style={{
              position: 'absolute',
              left: x - 1,
              top: yTop(74.3),
              width: 2,
              height: 52.3,
              backgroundColor: BLACK,
            }}
          />
        ))}

        {/* ============== 2. INFO BAND (y=74.3 to y=117.9) ============== */}
        <View
          style={{
            position: 'absolute',
            left: M_LEFT,
            top: yTop(117.9),
            width: M_RIGHT - M_LEFT,
            height: 43.6,
            backgroundColor: LIGHT_BLUE,
          }}
        />

        {/* Labels */}
        <Text style={infoLabelStyle(M_LEFT + 1.7, 82.3)}>NOMBRE DEL PROVEEDOR</Text>
        <Text style={infoLabelStyle(M_LEFT + 1.7, 96.8)}>CORREO ELECTRONICO</Text>
        <Text style={infoLabelStyle(M_LEFT + 1.7, 111.3)}>FECHA DE EVALUACIÓN</Text>

        {/* Values */}
        <Text
          style={{
            position: 'absolute',
            left: 255.9,
            top: yTop(81.6 + 10),
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: BLACK,
          }}
        >
          {proveedor}
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 255.8,
            top: yTop(96.8 + 9),
            fontFamily: 'Helvetica',
            fontSize: 9,
            color: BLACK,
          }}
        >
          {correo}
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 374.4,
            top: yTop(105.6 + 10),
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: BLACK,
          }}
        >
          {fecha}
        </Text>

        {/* Info band vertical separators */}
        {[44.0, 253.63, 542.48].map((x, i) => (
          <View
            key={`info-sep-${i}`}
            style={{
              position: 'absolute',
              left: x - 0.5,
              top: yTop(117.9),
              width: 1.5,
              height: 43.6,
              backgroundColor: BLACK,
            }}
          />
        ))}

        {/* ============== 3. SISTEMA DE PUNTUACIÓN (y=132.6) ============== */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(132.6 + 9),
            fontFamily: 'Helvetica-Bold',
            fontSize: 9,
            color: BLACK,
          }}
        >
          SISTEMA DE PUNTUACIÓN
        </Text>
        <Text style={scoreLabelStyle(255.7, 132.4)}>Malo=1</Text>
        <Text style={scoreLabelStyle(315.8, 132.4)}>Regular=2</Text>
        <Text style={scoreLabelStyle(364.5, 132.4)}>Bien=3</Text>
        <Text style={scoreLabelStyle(413.4, 132.4)}>Excelente=4</Text>

        {/* ============== 4. TABLE HEADER (y=145 to y=160.3) ============== */}
        <View
          style={{
            position: 'absolute',
            left: M_LEFT,
            top: yTop(160.3),
            width: CONTENT_W,
            height: 15.3,
            backgroundColor: LIGHT_BLUE,
          }}
        />
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(150 + 10),
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: BLACK,
          }}
        >
          Criterio a evaluar
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 388.5,
            top: yTop(150 + 10),
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: BLACK,
          }}
        >
          Calificación
        </Text>
        {/* Table header vertical separators */}
        {[44.0, 362.45, 460.08].map((x, i) => (
          <View
            key={`th-sep-${i}`}
            style={{
              position: 'absolute',
              left: x - 0.5,
              top: yTop(161.2),
              width: 1.5,
              height: 17.2,
              backgroundColor: BLACK,
            }}
          />
        ))}

        {/* ============== 5. CRITERIA ROWS ============== */}
        {criteria.map((label, i) => {
          const yBottom = 168 - i * 14.5
          const score = scores[i] || 0
          return (
            <View key={`crit-${i}`}>
              <Text
                style={{
                  position: 'absolute',
                  left: M_LEFT + 1.7,
                  top: yTop(yBottom + 9),
                  fontFamily: 'Helvetica',
                  fontSize: 9,
                  color: BLACK,
                }}
              >
                {label}
              </Text>
              <Text
                style={{
                  position: 'absolute',
                  left: 380,
                  top: yTop(yBottom + 10),
                  width: 35,
                  textAlign: 'right',
                  fontFamily: 'Helvetica-Bold',
                  fontSize: 10,
                  color: BLACK,
                }}
              >
                {String(score)}
              </Text>
            </View>
          )
        })}

        {/* Table vertical borders */}
        {[43.5, 362.45, 459.58].map((x, i) => (
          <View
            key={`tb-sep-${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: yTop(305),
              width: 1.5,
              height: 144,
              backgroundColor: BLACK,
            }}
          />
        ))}

        {/* ============== 6. TOTALS ============== */}
        {/* Total obtained */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(309.3 + 9),
            fontFamily: 'Helvetica-Bold',
            fontSize: 9,
            color: BLACK,
          }}
        >
          Total de puntos obtenidos
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 380,
            top: yTop(309.3 + 11),
            width: 35,
            textAlign: 'right',
            fontFamily: 'Helvetica-Bold',
            fontSize: 11,
            color: BLACK,
          }}
        >
          {String(ev.total)}
        </Text>
        {/* Total possible */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(323.8 + 9),
            fontFamily: 'Helvetica',
            fontSize: 9,
            color: BLACK,
          }}
        >
          Total de puntos posibles
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 380,
            top: yTop(323.8 + 10),
            width: 35,
            textAlign: 'right',
            fontFamily: 'Helvetica',
            fontSize: 10,
            color: BLACK,
          }}
        >
          40
        </Text>
        {/* Evaluation label + score */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(347.8 + 10),
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: BLACK,
          }}
        >
          Evaluación del proveedor=
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 270,
            top: yTop(347.8 + 14),
            width: 85,
            textAlign: 'right',
            fontFamily: 'Helvetica-Bold',
            fontSize: 14,
            color: BLACK,
          }}
        >
          {calificacion.toFixed(1)}
        </Text>

        {/* Classification box (right) */}
        <View
          style={{
            position: 'absolute',
            left: 425.7,
            top: yTop(360.93),
            width: 117.13,
            height: 18.9,
            backgroundColor: clsColor,
          }}
        />
        <Text
          style={{
            position: 'absolute',
            left: 425.7,
            top: yTop(360.93 + 5),
            width: 117.13,
            textAlign: 'center',
            fontFamily: 'Helvetica-Bold',
            fontSize: 12,
            color: clsTextColor,
          }}
        >
          {clasificacion}
        </Text>
        {/* Right border next to totals */}
        <View
          style={{
            position: 'absolute',
            left: 541.98,
            top: yTop(361.83),
            width: 2,
            height: 18.8,
            backgroundColor: BLACK,
          }}
        />

        {/* ============== 7. CLASSIFICATION LEGEND ============== */}
        {[
          { lbl: 'EXCELENTE', rng: '91 - 100', bg: DARK_GREEN, fg: WHITE },
          { lbl: 'BUENO', rng: '71 - 90', bg: LIGHT_GREEN, fg: BLACK },
          { lbl: 'REGULAR', rng: '51 - 70', bg: ORANGE, fg: BLACK },
          { lbl: 'MALO', rng: '0 - 50', bg: RED, fg: WHITE },
        ].map((row, i) => {
          const yBottom = 375.3 + (3 - i) * 14.55
          return (
            <View key={`leg-${i}`}>
              <View
                style={{
                  position: 'absolute',
                  left: M_LEFT,
                  top: yTop(yBottom + 14.55),
                  width: 48.9,
                  height: 14.55,
                  backgroundColor: row.bg,
                }}
              />
              <Text
                style={{
                  position: 'absolute',
                  left: M_LEFT - 2,
                  top: yTop(yBottom + 14.55) + 4.5,
                  width: 52.9,
                  textAlign: 'center',
                  fontFamily: 'Helvetica-Bold',
                  fontSize: 7.5,
                  color: row.fg,
                }}
              >
                {row.lbl}
              </Text>
              <Text
                style={{
                  position: 'absolute',
                  left: 95.2,
                  top: yTop(yBottom + 14.55) + 5,
                  fontFamily: 'Helvetica-Bold',
                  fontSize: 11,
                  color: BLACK,
                }}
              >
                {row.rng}
              </Text>
            </View>
          )
        })}
        {/* Legend left border */}
        <View
          style={{
            position: 'absolute',
            left: 43.5,
            top: yTop(433.79),
            width: 1.5,
            height: 58.97,
            backgroundColor: BLACK,
          }}
        />

        {/* ============== 8. OBSERVATIONS ============== */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(453.1 + 10),
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: BLACK,
          }}
        >
          Observaciones:
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(466.7 + 9),
            fontFamily: 'Helvetica',
            fontSize: 9,
            color: BLACK,
          }}
        >
          {(ev.observaciones || '').trim() || 'SIN OBSERVACIONES.'}
        </Text>
        <View
          style={{
            position: 'absolute',
            left: 43.5,
            top: yTop(503.6),
            width: 1.5,
            height: 41.7,
            backgroundColor: BLACK,
          }}
        />

        {/* ============== 9. SIGNATURE ROW ============== */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(524.4 + 8),
            fontFamily: 'Helvetica-Bold',
            fontSize: 8,
            color: BLACK,
          }}
        >
          Nombre del evaluador
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 275.1,
            top: yTop(524.4 + 8),
            fontFamily: 'Helvetica-Bold',
            fontSize: 8,
            color: BLACK,
          }}
        >
          Firma
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 427.1,
            top: yTop(524.4 + 8),
            fontFamily: 'Helvetica-Bold',
            fontSize: 8,
            color: BLACK,
          }}
        >
          Cargo
        </Text>

        {/* Signature image (centered in Firma column) */}
        {signatureDataUrl && (
          <PdfImage
            src={signatureDataUrl}
            style={{
              position: 'absolute',
              left: 275,
              top: yTop(567),
              width: 130,
              height: 40,
              objectFit: 'contain',
            }}
          />
        )}

        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(562.3 + 9),
            fontFamily: 'Helvetica',
            fontSize: 9,
            color: BLACK,
          }}
        >
          {ev.evaluador || 'Walter Piñera'}
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 431.1,
            top: yTop(562.3 + 8),
            fontFamily: 'Helvetica',
            fontSize: 8,
            color: BLACK,
          }}
        >
          {ev.cargo || 'Ingeniero Calidad y Compras'}
        </Text>

        {/* Signature underlines (drawn with thin Views) */}
        <View style={{ position: 'absolute', left: M_LEFT, top: yTop(558.3), width: 205, height: 0.5, backgroundColor: BLACK }} />
        <View style={{ position: 'absolute', left: 270, top: yTop(558.3), width: 140, height: 0.5, backgroundColor: BLACK }} />
        <View style={{ position: 'absolute', left: 427, top: yTop(558.3), width: M_RIGHT - 427, height: 0.5, backgroundColor: BLACK }} />

        {/* ============== 10. FOOTER ============== */}
        <Text
          style={{
            position: 'absolute',
            left: M_LEFT + 1.7,
            top: yTop(606.6 + 8),
            fontFamily: 'Helvetica',
            fontSize: 8,
            color: GRAY,
          }}
        >
          F-CAL-07 REV01
        </Text>

        {/* ============== OPTIONAL CHART PAGE ============== */}
        {chartDataUrl && (
          <Page
            size={[PAGE_W, PAGE_H]}
            style={{ margin: 0, padding: 0, position: 'relative' }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: PAGE_W,
                height: PAGE_H,
                backgroundColor: WHITE,
              }}
            />
            <Text
              style={{
                position: 'absolute',
                left: 0,
                top: 40,
                width: PAGE_W,
                textAlign: 'center',
                fontFamily: 'Helvetica-Bold',
                fontSize: 14,
                color: BLACK,
              }}
            >
              POSICIÓN COMPARATIVA ENTRE PROVEEDORES
            </Text>
            <Text
              style={{
                position: 'absolute',
                left: 0,
                top: 62,
                width: PAGE_W,
                textAlign: 'center',
                fontFamily: 'Helvetica',
                fontSize: 10,
                color: GRAY,
              }}
            >
              {ev.proveedor} - Calificación: {calificacion.toFixed(1)} ({clasificacion})
            </Text>
            <PdfImage
              src={chartDataUrl}
              style={{
                position: 'absolute',
                left: 40,
                top: 100,
                width: PAGE_W - 80,
                height: PAGE_H - 200,
                objectFit: 'contain',
              }}
            />
          </Page>
        )}
      </Page>
    </Document>
  )
}

function infoLabelStyle(x: number, yBottom: number) {
  return {
    position: 'absolute' as const,
    left: x,
    top: PAGE_H - (yBottom + 9),
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: BLACK,
  }
}

function scoreLabelStyle(x: number, yBottom: number) {
  return {
    position: 'absolute' as const,
    left: x,
    top: PAGE_H - (yBottom + 8),
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: BLACK,
  }
}

function formatDate(s: string): string {
  if (!s) return ''
  s = s.trim()
  if (s.includes('-') && s.length >= 10) {
    const parts = s.slice(0, 10).split('-')
    if (parts.length === 3) {
      const [y, m, d] = parts
      if (y && m && d) return `${m}/${d}/${y}`
    }
  }
  return s
}
