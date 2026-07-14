import { NextRequest, NextResponse } from 'next/server'
import { db, type Evaluation } from '@/lib/db'

/**
 * GET /api/evaluations/[id]/outlook-script
 *
 * Generates a VBScript (.vbs) file that, when double-clicked on Windows,
 * opens Outlook desktop with a new email pre-filled with:
 *   - Recipient (provider email)
 *   - Subject
 *   - Body (Spanish message)
 *   - PDF + chart PNG as attachments (looked up in the same folder as the script)
 *
 * The user only has to review and click "Send".
 *
 * Why this approach:
 *   Browsers cannot auto-attach files to emails (security restriction).
 *   mailto: only supports subject/body, not attachments.
 *   A VBScript uses Outlook COM automation to do the attach + open in one shot.
 *
 * Usage on user side:
 *   1. Download the PDF (button "Descargar PDF")
 *   2. Download the chart (button "Descargar gráfica")
 *   3. Download this .vbs script (button "Preparar Outlook")
 *   4. Make sure all 3 files are in the SAME folder (usually Downloads)
 *   5. Double-click the .vbs file → Outlook opens with everything ready
 */
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

  if (!ev.correo) {
    return NextResponse.json(
      { error: 'Este proveedor no tiene correo electrónico' },
      { status: 400 }
    )
  }

  // Build filenames matching what the PDF and chart endpoints serve
  const proveedorSafe = sanitizeFilename(ev.proveedor)
  const pdfFilename = `Evaluacion-${proveedorSafe}.pdf`
  const chartFilename = `Grafica-comparativa-${proveedorSafe}.png`

  const subject = `Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`
  const body = buildEmailBody(ev)
  const fechaFmt = formatDate(ev.fecha)

  // Generate VBScript
  // Use Chr(34) for double quotes inside VBScript strings to avoid escaping hell
  const vbs = buildVBScript({
    to: ev.correo,
    subject,
    body,
    pdfFilename,
    chartFilename,
    proveedor: ev.proveedor,
    fecha: fechaFmt,
    calificacion: ev.calificacion.toFixed(1),
    clasificacion: ev.clasificacion,
  })

  // Return as downloadable .vbs file (text/vbscript so Windows recognizes it)
  return new NextResponse(vbs, {
    status: 200,
    headers: {
      'Content-Type': 'text/vbscript; charset=utf-8',
      'Content-Disposition': `attachment; filename="Preparar-correo-${proveedorSafe}.vbs"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60)
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

function buildEmailBody(ev: Evaluation): string {
  const fechaFmt = formatDate(ev.fecha)
  const obs = (ev.observaciones || '').trim()
  return [
    `Estimado equipo de ${ev.proveedor},`,
    '',
    `Les compartimos los resultados de la evaluación de desempeño como proveedor, realizada el ${fechaFmt}.`,
    '',
    'RESUMEN DE LA EVALUACIÓN',
    `- Proveedor: ${ev.proveedor}`,
    `- Calificación final: ${ev.calificacion.toFixed(1)} / 100`,
    `- Clasificación: ${ev.clasificacion}`,
    `- Total de puntos: ${ev.total} / 40`,
    '',
    'Les adjuntamos:',
    '1. El reporte completo en PDF con el detalle por criterio.',
    `2. Una gráfica comparativa que muestra la posición de ${ev.proveedor} frente a los demás proveedores evaluados.`,
    '',
    obs ? `OBSERVACIONES:\n${obs}\n` : 'Sin observaciones.\n',
    'Quedamos atentos a sus comentarios y a continuar trabajando en la mejora continua.',
    '',
    'Saludos cordiales,',
    ev.evaluador,
    ev.cargo,
  ].join('\r\n')
}

/**
 * Builds a VBScript that opens Outlook desktop with a pre-filled email.
 *
 * The script:
 *   1. Finds the script's own folder (so it can find the PDF and PNG)
 *   2. Searches for the newest PDF and PNG matching the expected patterns
 *      (this handles browser adding "(1)" suffixes to duplicate downloads)
 *   3. Opens Outlook via COM automation
 *   4. Creates a new mail with To/Subject/Body and the 2 attachments
 *   5. Displays the mail (does NOT auto-send — user clicks Send)
 *
 * If Outlook is not installed or files are missing, shows a helpful message.
 */
function buildVBScript(opts: {
  to: string
  subject: string
  body: string
  pdfFilename: string
  chartFilename: string
  proveedor: string
  fecha: string
  calificacion: string
  clasificacion: string
}): string {
  // Escape strings for VBScript (double quotes → "")
  const q = (s: string) => s.replace(/"/g, '""')

  // VBScript string literals CANNOT contain literal newlines.
  // We split the body by CRLF and emit VBScript concatenation:
  //   "line1" & vbCrLf & "line2" & vbCrLf & ...
  // Each line is its own string literal, joined with vbCrLf.
  const bodyLines = opts.body.split(/\r?\n/).map((line) => `"${q(line)}"`).join(' & vbCrLf & ')

  // Subject escaped (single line, no newlines)
  const subjectEscaped = q(opts.subject)

  // Pattern for fuzzy matching (in case browser added (1), (2) etc.)
  const pdfBase = opts.pdfFilename.replace(/\.pdf$/i, '')
  const chartBase = opts.chartFilename.replace(/\.png$/i, '')
  const pdfPattern = `${pdfBase}*.pdf`
  const chartPattern = `${chartBase}*.png`

  return `' ============================================================
' Script para abrir Outlook con el correo de evaluacion listo
' Proveedor: ${opts.proveedor}
' Fecha: ${opts.fecha}
' Calificacion: ${opts.calificacion} (${opts.clasificacion})
' ============================================================
'
' INSTRUCCIONES:
'   1. Este script debe estar en la MISMA carpeta que los archivos:
'      - ${opts.pdfFilename}
'      - ${opts.chartFilename}
'   2. Si Outlook pide permiso, acepta (es un acceso programa).
'   3. El correo se abrira listo para revisar y enviar.
'   4. Revisa destinatario, asunto, cuerpo y adjuntos.
'   5. Presiona "Enviar" en Outlook cuando estes listo.

Option Explicit

Dim fso, outlook, mail, scriptDir, scriptFile
Dim pdfFile, chartFile, foundPdf, foundChart
Dim newestDate, f, name

On Error Resume Next

Set fso = CreateObject("Scripting.FileSystemObject")
scriptFile = WScript.ScriptFullName
scriptDir = fso.GetParentFolderName(scriptFile)

' --- Find newest PDF matching the pattern ---
foundPdf = False
newestDate = #1/1/1970#
For Each f In fso.GetFolder(scriptDir).Files
    name = LCase(f.Name)
    If name Like LCase("${pdfPattern}") Then
        If f.DateLastModified > newestDate Then
            newestDate = f.DateLastModified
            pdfFile = f.Path
            foundPdf = True
        End If
    End If
Next

' --- Find newest PNG matching the pattern ---
foundChart = False
newestDate = #1/1/1970#
For Each f In fso.GetFolder(scriptDir).Files
    name = LCase(f.Name)
    If name Like LCase("${chartPattern}") Then
        If f.DateLastModified > newestDate Then
            newestDate = f.DateLastModified
            chartFile = f.Path
            foundChart = True
        End If
    End If
Next

If Not foundPdf Or Not foundChart Then
    Dim missing
    missing = "No se encontraron los archivos necesarios en la carpeta:" & vbCrLf & vbCrLf
    missing = missing & "Carpeta: " & scriptDir & vbCrLf & vbCrLf
    If Not foundPdf Then missing = missing & "  X Falta: ${opts.pdfFilename}" & vbCrLf
    If Not foundChart Then missing = missing & "  X Falta: ${opts.chartFilename}" & vbCrLf
    missing = missing & vbCrLf & "Descarga el PDF y la grafica desde la web y vuelve a ejecutar este script."
    MsgBox missing, vbExclamation, "Archivos faltantes"
    WScript.Quit 1
End If

' --- Open Outlook and create the email ---
Set outlook = CreateObject("Outlook.Application")
If Err.Number <> 0 Then
    MsgBox "No se pudo abrir Microsoft Outlook." & vbCrLf & vbCrLf & "Asegurate de tener Outlook instalado y configurado.", vbCritical, "Error"
    WScript.Quit 1
End If

Set mail = outlook.CreateItem(0)
mail.To = "${q(opts.to)}"
mail.Subject = "${subjectEscaped}"
mail.Body = ${bodyLines}

' Add attachments
mail.Attachments.Add pdfFile
mail.Attachments.Add chartFile

' Display the email so the user can review and send
mail.Display

Set mail = Nothing
Set outlook = Nothing
Set fso = Nothing
`;
}
