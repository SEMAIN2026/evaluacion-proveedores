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
// All coordinates below use TOP-LEFT origin (PyMuPDF / CSS convention)
// y=0 is the TOP of the page, y increases DOWNWARD.
const PAGE_W = 595.28
const PAGE_H = 841.89

const M_LEFT = 44.5
const M_RIGHT = 543.08
const CONTENT_W = M_RIGHT - M_LEFT
const COL1_RIGHT = 254.13
const COL2_RIGHT = 460.68

// Colors — refined SEMAIN palette (brand-aligned, slightly softer)
const LIGHT_BLUE = '#E8F2D5'      // soft SEMAIN-green tint (was harsh blue)
const LIGHT_BLUE_HEADER = '#F0F7E3' // even softer for table header
const DARK_GREEN = '#7BA635'       // SEMAIN green (darker shade for EXCELENTE)
const LIGHT_GREEN = '#A0CD50'      // SEMAIN green (BUENO)
const ORANGE = '#E8923C'           // softer amber (was garish #FFC000)
const RED = '#D9534F'              // muted red (was harsh #FF0000)
const BLACK = '#302C2B'            // SEMAIN charcoal (was pure black)
const DARK_TEXT = '#1F1B1A'        // slightly softer for body text
const MUTED_TEXT = '#6B6968'       // for secondary text
const SEMAIN_DARK = '#302C2B'      // brand dark for header
const SEMAIN_GREEN = '#A0CD50'     // brand green accent
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

  // Helper to create absolute-positioned text
  const txt = (x: number, y: number, text: string, opts: {
    font?: string
    size?: number
    color?: string
    width?: number
    align?: 'left' | 'center' | 'right'
  } = {}) => ({
    position: 'absolute' as const,
    left: x,
    top: y,
    width: opts.width,
    textAlign: opts.align,
    fontFamily: opts.font || 'Helvetica',
    fontSize: opts.size || 9,
    color: opts.color || BLACK,
  })

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
        {/* 3-column background fills — WHITE with green accent line */}
        <View style={{ position: 'absolute', left: M_LEFT, top: 22, width: COL1_RIGHT - M_LEFT, height: 52.3, backgroundColor: WHITE }} />
        <View style={{ position: 'absolute', left: COL1_RIGHT, top: 22, width: COL2_RIGHT - COL1_RIGHT, height: 52.3, backgroundColor: WHITE }} />
        <View style={{ position: 'absolute', left: COL2_RIGHT, top: 22, width: M_RIGHT - COL2_RIGHT, height: 52.3, backgroundColor: WHITE }} />
        {/* Green accent line at bottom of header */}
        <View style={{ position: 'absolute', left: M_LEFT, top: 73.3, width: M_RIGHT - M_LEFT, height: 2, backgroundColor: SEMAIN_GREEN }} />

        {/* Logo (left column, centered) */}
        {logoDataUrl && (
          <PdfImage
            src={logoDataUrl}
            style={{
              position: 'absolute',
              left: M_LEFT + 4,
              top: 26,
              width: COL1_RIGHT - M_LEFT - 8,
              height: 44,
              objectFit: 'contain',
            }}
          />
        )}

        {/* Title (middle column, centered) — dark text on white */}
        <Text
          style={{
            position: 'absolute',
            left: COL1_RIGHT,
            top: 42,
            width: COL2_RIGHT - COL1_RIGHT,
            textAlign: 'center',
            fontFamily: 'Helvetica-Bold',
            fontSize: 11,
            color: SEMAIN_DARK,
          }}
        >
          EVALUACIÓN DE PROVEEDORES
        </Text>

        {/* Code & date (right column) — dark text on white */}
        <Text style={{ position: 'absolute', left: 475.9, top: 39, fontFamily: 'Helvetica', fontSize: 8, color: SEMAIN_DARK }}>
          F-CAL-07 REV01
        </Text>
        <Text style={{ position: 'absolute', left: 475.9, top: 50, fontFamily: 'Helvetica', fontSize: 8, color: MUTED_TEXT }}>
          05/07/2021
        </Text>

        {/* Black vertical separators (header) */}
        {[M_LEFT, COL1_RIGHT, COL2_RIGHT, M_RIGHT].map((x, i) => (
          <View key={`hdr-sep-${i}`} style={{ position: 'absolute', left: x - 1, top: 22, width: 2, height: 52.3, backgroundColor: BLACK }} />
        ))}

        {/* ============== 2. INFO BAND (y=74.3 to y=117.9) ============== */}
        <View style={{ position: 'absolute', left: M_LEFT, top: 74.3, width: M_RIGHT - M_LEFT, height: 43.6, backgroundColor: LIGHT_BLUE }} />

        {/* Labels */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 78.3, fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLACK }}>
          NOMBRE DEL PROVEEDOR
        </Text>
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 92.8, fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLACK }}>
          CORREO ELECTRONICO
        </Text>
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 107.3, fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLACK }}>
          FECHA DE EVALUACIÓN
        </Text>

        {/* Values */}
        <Text style={{ position: 'absolute', left: 255.9, top: 77.6, fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK }}>
          {proveedor}
        </Text>
        <Text style={{ position: 'absolute', left: 255.8, top: 92.8, fontFamily: 'Helvetica', fontSize: 9, color: BLACK }}>
          {correo}
        </Text>
        <Text style={{ position: 'absolute', left: 374.4, top: 106.6, fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK }}>
          {fecha}
        </Text>

        {/* Info band vertical separators */}
        {[44.0, 253.63, 542.48].map((x, i) => (
          <View key={`info-sep-${i}`} style={{ position: 'absolute', left: x - 0.5, top: 74.3, width: 1.5, height: 43.6, backgroundColor: BLACK }} />
        ))}

        {/* ============== 3. SISTEMA DE PUNTUACIÓN (y=129.6) ============== */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 129.6, fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLACK }}>
          SISTEMA DE PUNTUACIÓN
        </Text>
        <Text style={{ position: 'absolute', left: 255.7, top: 130.4, fontFamily: 'Helvetica', fontSize: 8, color: BLACK }}>Malo=1</Text>
        <Text style={{ position: 'absolute', left: 315.8, top: 130.4, fontFamily: 'Helvetica', fontSize: 8, color: BLACK }}>Regular=2</Text>
        <Text style={{ position: 'absolute', left: 364.5, top: 130.4, fontFamily: 'Helvetica', fontSize: 8, color: BLACK }}>Bien=3</Text>
        <Text style={{ position: 'absolute', left: 413.4, top: 130.4, fontFamily: 'Helvetica', fontSize: 8, color: BLACK }}>Excelente=4</Text>

        {/* ============== 4. TABLE HEADER (y=145 to y=160.3) ============== */}
        <View style={{ position: 'absolute', left: M_LEFT, top: 145, width: CONTENT_W, height: 15.3, backgroundColor: '#F0F7E3' }} />
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 148, fontFamily: 'Helvetica-Bold', fontSize: 10, color: SEMAIN_DARK }}>
          Criterio a evaluar
        </Text>
        <Text style={{ position: 'absolute', left: 388.5, top: 148, fontFamily: 'Helvetica-Bold', fontSize: 10, color: SEMAIN_DARK }}>
          Calificación
        </Text>
        {/* Table header vertical separators */}
        {[44.0, 362.45, 460.08].map((x, i) => (
          <View key={`th-sep-${i}`} style={{ position: 'absolute', left: x - 0.5, top: 144, width: 1.5, height: 17.2, backgroundColor: BLACK }} />
        ))}

        {/* ============== 5. CRITERIA ROWS (y=163.5 to y=304) ============== */}
        {criteria.map((label, i) => {
          const y = 163.5 + i * 14.5
          const score = scores[i] || 0
          return (
            <View key={`crit-${i}`}>
              {/* Alternating row background for readability */}
              {i % 2 === 1 && (
                <View style={{ position: 'absolute', left: M_LEFT, top: y - 2, width: CONTENT_W, height: 14.5, backgroundColor: '#F8FAF3' }} />
              )}
              <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: y, fontFamily: 'Helvetica', fontSize: 9, color: DARK_TEXT }}>
                {label}
              </Text>
              <Text
                style={{
                  position: 'absolute',
                  left: 380,
                  top: y - 0.5,
                  width: 35,
                  textAlign: 'right',
                  fontFamily: 'Helvetica-Bold',
                  fontSize: 10,
                  color: DARK_TEXT,
                }}
              >
                {String(score)}
              </Text>
            </View>
          )
        })}

        {/* Table vertical borders (left, middle, right) - span full table height */}
        <View style={{ position: 'absolute', left: 43.5, top: 161, width: 1.5, height: 145, backgroundColor: BLACK }} />
        <View style={{ position: 'absolute', left: 362.45, top: 161, width: 1.5, height: 145, backgroundColor: BLACK }} />
        <View style={{ position: 'absolute', left: 459.58, top: 161, width: 1.5, height: 145, backgroundColor: BLACK }} />

        {/* ============== 6. TOTALS (y=305 to y=360) ============== */}
        {/* Total obtained (y=309.3) */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 309.3, fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLACK }}>
          Total de puntos obtenidos
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 380,
            top: 307.5,
            width: 35,
            textAlign: 'right',
            fontFamily: 'Helvetica-Bold',
            fontSize: 11,
            color: BLACK,
          }}
        >
          {String(ev.total)}
        </Text>

        {/* Total possible (y=323.8) */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 323.8, fontFamily: 'Helvetica', fontSize: 9, color: BLACK }}>
          Total de puntos posibles
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 380,
            top: 323,
            width: 35,
            textAlign: 'right',
            fontFamily: 'Helvetica',
            fontSize: 10,
            color: BLACK,
          }}
        >
          40
        </Text>

        {/* Evaluation label + score (y=347.8) */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 347.8, fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK }}>
          Evaluación del proveedor=
        </Text>
        <Text
          style={{
            position: 'absolute',
            left: 280,
            top: 344.5,
            width: 75,
            textAlign: 'right',
            fontFamily: 'Helvetica-Bold',
            fontSize: 14,
            color: BLACK,
          }}
        >
          {calificacion.toFixed(1)}
        </Text>

        {/* Classification box (right side, y=342 to y=361) */}
        <View
          style={{
            position: 'absolute',
            left: 425.7,
            top: 342,
            width: 117.13,
            height: 18.9,
            backgroundColor: clsColor,
          }}
        />
        <Text
          style={{
            position: 'absolute',
            left: 425.7,
            top: 347,
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
        <View style={{ position: 'absolute', left: 541.98, top: 343, width: 2, height: 18.8, backgroundColor: BLACK }} />

        {/* ============== 7. CLASSIFICATION LEGEND (y=375 to y=434) ============== */}
        {[
          { lbl: 'EXCELENTE', rng: '91 - 100', bg: DARK_GREEN, fg: WHITE },
          { lbl: 'BUENO', rng: '71 - 90', bg: LIGHT_GREEN, fg: BLACK },
          { lbl: 'REGULAR', rng: '51 - 70', bg: ORANGE, fg: BLACK },
          { lbl: 'MALO', rng: '0 - 50', bg: RED, fg: WHITE },
        ].map((row, i) => {
          const y = 375.3 + i * 14.55
          return (
            <View key={`leg-${i}`}>
              <View
                style={{
                  position: 'absolute',
                  left: M_LEFT,
                  top: y,
                  width: 48.9,
                  height: 14.55,
                  backgroundColor: row.bg,
                }}
              />
              <Text
                style={{
                  position: 'absolute',
                  left: M_LEFT - 2,
                  top: y + 4,
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
                  top: y + 4.5,
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
        <View style={{ position: 'absolute', left: 43.5, top: 374.8, width: 1.5, height: 59, backgroundColor: BLACK }} />

        {/* ============== 8. OBSERVATIONS (y=451 to y=504) ============== */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 451.1, fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK }}>
          Observaciones:
        </Text>
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 464.7, fontFamily: 'Helvetica', fontSize: 9, color: BLACK }}>
          {(ev.observaciones || '').trim() || 'SIN OBSERVACIONES.'}
        </Text>
        {/* Left border for observations */}
        <View style={{ position: 'absolute', left: 43.5, top: 461.9, width: 1.5, height: 41.7, backgroundColor: BLACK }} />

        {/* ============== 9. SIGNATURE ROW (y=522 to y=570) ============== */}
        {/* Column labels (y=522.4) */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 522.4, fontFamily: 'Helvetica-Bold', fontSize: 8, color: BLACK }}>
          Nombre del evaluador
        </Text>
        <Text style={{ position: 'absolute', left: 275.1, top: 522.4, fontFamily: 'Helvetica-Bold', fontSize: 8, color: BLACK }}>
          Firma
        </Text>
        <Text style={{ position: 'absolute', left: 427.1, top: 522.4, fontFamily: 'Helvetica-Bold', fontSize: 8, color: BLACK }}>
          Cargo
        </Text>

        {/* Signature image (in Firma column, above the underline) */}
        {signatureDataUrl && (
          <PdfImage
            src={signatureDataUrl}
            style={{
              position: 'absolute',
              left: 275,
              top: 535,
              width: 130,
              height: 28,
              objectFit: 'contain',
            }}
          />
        )}

        {/* Name value (y=560.3) */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 560.3, fontFamily: 'Helvetica', fontSize: 9, color: BLACK }}>
          {ev.evaluador || 'Walter Piñera'}
        </Text>
        {/* Cargo value (y=560.9) */}
        <Text style={{ position: 'absolute', left: 431.1, top: 560.9, fontFamily: 'Helvetica', fontSize: 8, color: BLACK }}>
          {ev.cargo || 'Ingeniero Calidad y Compras'}
        </Text>

        {/* Signature underlines (y=570) */}
        <View style={{ position: 'absolute', left: M_LEFT, top: 570, width: 205, height: 0.5, backgroundColor: BLACK }} />
        <View style={{ position: 'absolute', left: 270, top: 570, width: 140, height: 0.5, backgroundColor: BLACK }} />
        <View style={{ position: 'absolute', left: 427, top: 570, width: M_RIGHT - 427, height: 0.5, backgroundColor: BLACK }} />

        {/* ============== 10. FOOTER (y=604.6) ============== */}
        <Text style={{ position: 'absolute', left: M_LEFT + 1.7, top: 604.6, fontFamily: 'Helvetica', fontSize: 8, color: GRAY }}>
          F-CAL-07 REV01
        </Text>

        {/* ============== OPTIONAL CHART PAGE ============== */}
        {chartDataUrl && (
          <Page
            size={[PAGE_W, PAGE_H]}
            style={{ margin: 0, padding: 0, position: 'relative' }}
          >
            <View style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: PAGE_H, backgroundColor: WHITE }} />
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
// build trigger Wed Jul  8 17:22:42 UTC 2026
// cache bust 1784133386
