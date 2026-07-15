import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await db.execute({
    sql: `SELECT * FROM supplier_selections WHERE id = ? LIMIT 1`,
    args: [id],
  })
  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  }
  const r = res.rows[0]

  const sel = {
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
  }

  // Load logo
  let logoDataUrl: string | null = null
  try {
    const logoBuf = await readFile(join(process.cwd(), 'public', 'assets', 'logo.png'))
    logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`
  } catch {}

  const pdfBuffer = await renderToBuffer(FCom19Document({ sel, logoDataUrl }))

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="F-COM-19-${sel.proveedor.replace(/\s+/g, '_')}.pdf"`,
    },
  })
}

const SEMAIN_DARK = '#302C2B'
const SEMAIN_GREEN = '#A0CD50'
const SEMAIN_GREEN_DARK = '#7BA635'
const LIGHT_GREEN_TINT = '#F0F7E3'
const WHITE = '#FFFFFF'
const BLACK = '#1F1B1A'
const MUTED = '#6B6968'
const BORDER = '#D1D5DB'

interface SelData {
  id: string
  proveedor: string
  fecha: string
  evaluador: string
  cotizacion_tiempo: string
  inconformidad_tiempo: string
  entrega_tiempo: string
  cantidad_entregada: string
  especificaciones: string
  calidad_precio: string
  requisitos_legales: string
  iso_9001: string
  calificacion: number
  desempeno: string
  observaciones: string
}

function FCom19Document({ sel, logoDataUrl }: { sel: SelData; logoDataUrl: string | null }): ReactElement {
  const fechaFmt = formatDate(sel.fecha)

  // Score lookup for display
  const SCORES = {
    cotizacion: { '1-5': 10, '6-15': 6, '>15': 1 },
    inconformidad: { '1-3': 10, '4-8': 7, '>8': 5, 'no': 1 },
    entrega: { 'justo': 10, '1-7': 7, '8-15': 5, '>15': 1 },
    cantidad: { 'exacta': 10, 'faltante_justificado': 6, 'faltante_injustificado': 1 },
    especificaciones: { 'cumple': 10, 'no_cumple': 1 },
    calidad_precio: { 'mayor_menor': 10, 'mayor_mayor': 7, 'menor_mayor': 5, 'menor_menor': 1 },
    requisitos_legales: { 'cumple': 10, 'no_cumple': 1 },
  }

  const OPTIONS = {
    cotizacion: [
      { val: '1-5', label: 'En un plazo de 1 a 5 días', score: 10 },
      { val: '6-15', label: 'En un plazo de 6 a 15 días', score: 6 },
      { val: '>15', label: 'En un plazo mayor a 15 días', score: 1 },
    ],
    inconformidad: [
      { val: '1-3', label: 'En un plazo de 1 a 3 días', score: 10 },
      { val: '4-8', label: 'En un plazo de 4 a 8 días', score: 7 },
      { val: '>8', label: 'En un plazo mayor a 8 días', score: 5 },
      { val: 'no', label: 'No atiende una inconformidad o queja', score: 1 },
    ],
    entrega: [
      { val: 'justo', label: 'Justo a tiempo o anticipado', score: 10 },
      { val: '1-7', label: 'Entrega con retraso de 1 a 7 días', score: 7 },
      { val: '8-15', label: 'Entrega con retraso de 8 a 15 días', score: 5 },
      { val: '>15', label: 'Entrega con retraso mayor a 15 días', score: 1 },
    ],
    cantidad: [
      { val: 'exacta', label: 'Entrega la cantidad exacta o mayor debidamente justificada', score: 10 },
      { val: 'faltante_justificado', label: 'Entrega con faltante justificado que entrega en un plazo de 1 a 3 días', score: 6 },
      { val: 'faltante_injustificado', label: 'Entrega con faltante injustificado que no entrega posteriormente', score: 1 },
    ],
    especificaciones: [
      { val: 'cumple', label: 'Sí cumplen con las especificaciones del cliente', score: 10 },
      { val: 'no_cumple', label: 'No cumplen con las especificaciones del cliente', score: 1 },
    ],
    calidad_precio: [
      { val: 'mayor_menor', label: 'El bien o servicio es de mayor calidad y menor precio', score: 10 },
      { val: 'mayor_mayor', label: 'El bien o servicio es de mayor calidad y mayor precio', score: 7 },
      { val: 'menor_mayor', label: 'El bien o servicio es de menor calidad y mayor precio', score: 5 },
      { val: 'menor_menor', label: 'El bien o servicio es de menor calidad y menor precio', score: 1 },
    ],
    requisitos_legales: [
      { val: 'cumple', label: 'Sí cumple con los requisitos legales y reglamentarios', score: 10 },
      { val: 'no_cumple', label: 'No cumple con los requisitos legales y reglamentarios', score: 1 },
    ],
  }

  const renderOptions = (key: keyof typeof OPTIONS, selectedVal: string) => (
    <View>
      {OPTIONS[key].map((opt, i) => {
        const isSelected = opt.val === selectedVal
        return (
          <View key={`${key}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2, paddingLeft: 16 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: isSelected ? SEMAIN_GREEN_DARK : BLACK, width: 14 }}>
              {isSelected ? '☑' : '☐'}
            </Text>
            <Text style={{ fontSize: 9, fontFamily: isSelected ? 'Helvetica-Bold' : 'Helvetica', color: isSelected ? SEMAIN_GREEN_DARK : BLACK, flex: 1 }}>
              {opt.label}
            </Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: isSelected ? SEMAIN_GREEN_DARK : MUTED, width: 24, textAlign: 'right' }}>
              {opt.score}
            </Text>
          </View>
        )
      })}
    </View>
  )

  const desempenoColor =
    sel.desempeno === 'DESEMPEÑO NOTABLE' ? SEMAIN_GREEN_DARK :
    sel.desempeno === 'DESEMPEÑO CONFIABLE' ? '#5B9BD5' :
    sel.desempeno === 'DESEMPEÑO RIESGOSO' ? '#E8923C' :
    '#D9534F'

  return (
    <Document
      title={`F-COM-19 ${sel.proveedor}`}
      author={sel.evaluador}
      subject="Formato de Selección y Aceptación de Proveedores F-COM-19 Rev.00"
      creator="SEMAIN - Sistema de Evaluación de Proveedores"
    >
      <Page size="A4" style={{ margin: 0, padding: 0, position: 'relative', fontSize: 9, fontFamily: 'Helvetica', color: BLACK }}>
        {/* Header */}
        <View style={{ backgroundColor: WHITE, borderBottomWidth: 3, borderBottomColor: SEMAIN_GREEN, flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 10 }}>
          {logoDataUrl && (
            <PdfImage src={logoDataUrl} style={{ width: 120, height: 32, marginRight: 16, objectFit: 'contain' }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: SEMAIN_DARK }}>
              FORMATO DE SELECCIÓN Y ACEPTACIÓN DE PROVEEDORES
            </Text>
            <Text style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>
              F-COM-19 Rev.00
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={{ padding: 20 }}>
          {/* Supplier info */}
          <View style={{ flexDirection: 'row', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 }}>NOMBRE O RAZÓN SOCIAL DEL PROVEEDOR</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLACK }}>{sel.proveedor.toUpperCase()}</Text>
            </View>
            <View style={{ width: 120, marginLeft: 16 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 }}>FECHA</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLACK }}>{fechaFmt}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 }}>NOMBRE DEL EVALUADOR</Text>
              <Text style={{ fontSize: 10, color: BLACK }}>{sel.evaluador}</Text>
            </View>
            <View style={{ width: 140, marginLeft: 16, backgroundColor: LIGHT_GREEN_TINT, borderRadius: 4, padding: 6 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 }}>CALIFICACIÓN</Text>
              <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: SEMAIN_GREEN_DARK }}>{sel.calificacion.toFixed(2)} / 10</Text>
            </View>
          </View>

          {/* Criteria sections */}
          {/* CRITERIO 1: Capacidad de respuesta (25%) */}
          <View style={{ marginBottom: 10 }}>
            <View style={{ backgroundColor: '#F0F7E3', borderBottomWidth: 2, borderBottomColor: SEMAIN_GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: SEMAIN_DARK }}>
                CRITERIO 1: CAPACIDAD DE RESPUESTA — Peso 25%
              </Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                1.1 ¿En cuánto tiempo el proveedor entrega una cotización después de solicitada?
              </Text>
              {renderOptions('cotizacion', sel.cotizacion_tiempo)}
              <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: BORDER }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                  1.2 ¿Cuánto tiempo tarda en atender una inconformidad o queja?
                </Text>
                {renderOptions('inconformidad', sel.inconformidad_tiempo)}
              </View>
            </View>
          </View>

          {/* CRITERIO 2: Entrega de bienes (40%) */}
          <View style={{ marginBottom: 10 }}>
            <View style={{ backgroundColor: '#F0F7E3', borderBottomWidth: 2, borderBottomColor: SEMAIN_GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: SEMAIN_DARK }}>
                CRITERIO 2: ENTREGA DE BIENES — Peso 40%
              </Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                2.1 ¿Cuál es el tiempo que tarda en entregar un bien y/o prestar un servicio?
              </Text>
              {renderOptions('entrega', sel.entrega_tiempo)}
              <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: BORDER }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                  2.2 ¿El proveedor entrega la cantidad solicitada?
                </Text>
                {renderOptions('cantidad', sel.cantidad_entregada)}
              </View>
            </View>
          </View>

          {/* CRITERIO 3: Cumplimiento de requisitos (35%) */}
          <View style={{ marginBottom: 10 }}>
            <View style={{ backgroundColor: '#F0F7E3', borderBottomWidth: 2, borderBottomColor: SEMAIN_GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: SEMAIN_DARK }}>
                CRITERIO 3: CUMPLIMIENTO DE REQUISITOS — Peso 35%
              </Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                3.1 ¿Los bienes y/o servicios cumplen con las especificaciones del cliente?
              </Text>
              {renderOptions('especificaciones', sel.especificaciones)}
              <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: BORDER }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                  3.2 ¿El bien o servicio tiene un balance entre calidad y precio?
                </Text>
                {renderOptions('calidad_precio', sel.calidad_precio)}
              </View>
              <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: BORDER }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                  3.3 ¿El bien o servicio cumple con los requisitos legales y reglamentarios?
                </Text>
                {renderOptions('requisitos_legales', sel.requisitos_legales)}
              </View>
            </View>
          </View>

          {/* CRITERIO 4: Certificaciones */}
          <View style={{ marginBottom: 10 }}>
            <View style={{ backgroundColor: '#F0F7E3', borderBottomWidth: 2, borderBottomColor: SEMAIN_GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: SEMAIN_DARK }}>
                CRITERIO 4: CERTIFICACIONES
              </Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>
                ¿Cuenta con certificación ISO 9001?
              </Text>
              <View style={{ flexDirection: 'row', paddingLeft: 16, gap: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: sel.iso_9001 === 'SI' ? SEMAIN_GREEN_DARK : BLACK, marginRight: 4 }}>
                    {sel.iso_9001 === 'SI' ? '☑' : '☐'}
                  </Text>
                  <Text style={{ fontSize: 9, fontFamily: sel.iso_9001 === 'SI' ? 'Helvetica-Bold' : 'Helvetica', color: sel.iso_9001 === 'SI' ? SEMAIN_GREEN_DARK : BLACK }}>
                    SÍ
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: sel.iso_9001 === 'NO' ? '#D9534F' : BLACK, marginRight: 4 }}>
                    {sel.iso_9001 === 'NO' ? '☑' : '☐'}
                  </Text>
                  <Text style={{ fontSize: 9, fontFamily: sel.iso_9001 === 'NO' ? 'Helvetica-Bold' : 'Helvetica', color: sel.iso_9001 === 'NO' ? '#D9534F' : BLACK }}>
                    NO
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Result */}
          <View style={{ backgroundColor: LIGHT_GREEN_TINT, borderWidth: 2, borderColor: SEMAIN_GREEN, borderRadius: 6, padding: 12, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 }}>RESULTADO DE LA EVALUACIÓN</Text>
                <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: SEMAIN_GREEN_DARK }}>
                  {sel.calificacion.toFixed(2)}
                </Text>
                <Text style={{ fontSize: 9, color: MUTED }}>sobre 10</Text>
              </View>
              <View style={{ backgroundColor: desempenoColor, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'center' }}>
                  {sel.desempeno}
                </Text>
              </View>
            </View>
          </View>

          {/* Performance scale */}
          <View style={{ marginBottom: 10, padding: 8, backgroundColor: '#F8FAF3', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 3 }}>ESCALA DE DESEMPEÑO</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{ fontSize: 8, color: BLACK }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: SEMAIN_GREEN_DARK }}>Notable:</Text> 9-10  ·  {' '}
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#5B9BD5' }}>Confiable:</Text> 8-8.99  ·  {' '}
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#E8923C' }}>Riesgoso:</Text> 7-7.99  ·  {' '}
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#D9534F' }}>Crítico:</Text> {'<'}7
              </Text>
            </View>
          </View>

          {/* Observations */}
          {sel.observaciones && sel.observaciones.trim() && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 3 }}>Observaciones:</Text>
              <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 6, minHeight: 30 }}>
                <Text style={{ fontSize: 9, color: BLACK }}>{sel.observaciones}</Text>
              </View>
            </View>
          )}

          {/* Signature */}
          <View style={{ flexDirection: 'row', marginTop: 10, gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 22 }}>Nombre del evaluador</Text>
              <Text style={{ fontSize: 9, color: BLACK, marginBottom: 2 }}>{sel.evaluador}</Text>
              <View style={{ borderBottomWidth: 1, borderBottomColor: BLACK }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 22 }}>Firma</Text>
              <View style={{ borderBottomWidth: 1, borderBottomColor: BLACK }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 22 }}>Cargo</Text>
              <Text style={{ fontSize: 9, color: Blackish(), marginBottom: 2 }}>Ingeniero Calidad y Compras</Text>
              <View style={{ borderBottomWidth: 1, borderBottomColor: BLACK }} />
            </View>
          </View>

          <Text style={{ fontSize: 7, color: MUTED, textAlign: 'center', marginTop: 12 }}>
            F-COM-19 Rev.00 · Documento generado por SEMAIN - Sistema de Evaluación de Proveedores
          </Text>
        </View>
      </Page>
    </Document>
  )
}

function Blackish() { return BLACK }

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}
