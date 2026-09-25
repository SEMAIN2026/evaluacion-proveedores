'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Loader2, Mail, Copy, Download, CheckCircle2, AlertCircle,
  FileText, Image as ImageIcon, MessageCircle, Phone, FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Evaluation } from '@/lib/evaluations'

interface Props {
  ev: Evaluation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluador: string
  cargo: string
  /** Fired after the user downloads an EML OR opens WhatsApp for this ev.
   *  The backend has already marked the row as enviado; this is so the
   *  parent can refresh its state / show the green badge. */
  onSent?: (tipo: 'EML' | 'WHATSAPP') => void
}

export function EmailModal({ ev, open, onOpenChange, evaluador, cargo, onSent }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [to, setTo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ev) {
      setTo(ev.correo || '')
      setTelefono(ev.telefono || '')
      setSubject(`Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`)
      setBody(buildDefaultBody(ev, evaluador, cargo))
      setDownloaded(false)
      setError(null)
    }
  }, [ev, evaluador, cargo])

  if (!ev) return null

  const hasEmail = !!ev.correo
  const hasPhone = !!ev.telefono

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  /** Normalize a phone number to wa.me format: digits only, with country code. */
  const buildWhatsAppHref = (rawPhone: string, message: string): string => {
    // Strip everything except digits, but keep a leading "+" prefix
    let digits = rawPhone.replace(/[^\d]/g, '')
    // If it doesn't start with country code (Mexico default = 52), prepend it.
    if (digits.length === 10) digits = '52' + digits
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  }

  /** Download the .eml file (with PDF + chart attachments embedded). */
  const handleDownloadEml = async () => {
    if (!to.trim()) {
      setError('Agrega un correo de destino para el EML.')
      return
    }
    setDownloading(true)
    setError(null)
    setDownloaded(false)
    try {
      const params = new URLSearchParams({
        to,
        subject,
        body,
        fromName: evaluador,
        fromEmail: 'evaluacion@semain.com.mx',
      })
      const url = `/api/evaluations/${ev.id}/eml?${params.toString()}`
      // Use fetch to get the blob so we can trigger a download with the right filename
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      // Force download
      const a = document.createElement('a')
      const objUrl = URL.createObjectURL(blob)
      a.href = objUrl
      a.download = `evaluacion-${ev.proveedor.replace(/[^\w\-]+/g, '_')}.eml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objUrl)
      setDownloaded(true)
      // Notify parent so the green "Enviado" badge appears on the card.
      // The backend already marked the row as enviado via the EML endpoint,
      // but we call onSent so the parent refreshes its local state.
      onSent?.('EML')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar EML')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600" />
            Enviar evaluación a {ev.proveedor}
          </DialogTitle>
          <DialogDescription>
            El mensaje se generará con el <strong>PDF de evaluación</strong> y la <strong>gráfica
            comparativa</strong> incluidos. Solo se admiten EML (descarga para tu cliente de correo) o WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat label="Calificación" value={`${ev.calificacion.toFixed(1)}/100`} />
          <Stat label="Clasificación" value={ev.clasificacion} />
          <Stat label="Puntos" value={`${ev.total}/40`} />
          <Stat label="Fecha" value={formatDate(ev.fecha)} />
        </div>

        <Tabs defaultValue="eml" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="eml">
              <FileDown className="w-4 h-4 mr-2" />
              Descargar EML
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          {/* ---------- Option A: Download EML ---------- */}
          <TabsContent value="eml" className="space-y-3 mt-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                ¿Cómo funciona el EML?
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-emerald-800 text-[13px]">
                <li>Revisa los campos <strong>Para</strong>, <strong>Asunto</strong> y <strong>Mensaje</strong> abajo.</li>
                <li>Pulsa <strong>&ldquo;Descargar EML&rdquo;</strong>. Se descargará un archivo <code>.eml</code> con el PDF y la gráfica ya adjuntos.</li>
                <li>Doble clic en el archivo descargado: se abrirá en Outlook, Thunderbird, Apple Mail, Windows Mail o tu cliente de correo predeterminado.</li>
                <li>Revisa el contenido y pulsa <strong>Enviar</strong> en tu correo.</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default" className="bg-slate-900 hover:bg-slate-800">
                <a href={`/api/evaluations/${ev.id}/pdf?withChart=1`} target="_blank" rel="noopener noreferrer" download>
                  <FileText className="w-4 h-4 mr-2" />
                  Ver PDF
                </a>
              </Button>
              <Button asChild size="sm" variant="default" className="bg-emerald-700 hover:bg-emerald-800">
                <a href={`/api/evaluations/${ev.id}/chart`} target="_blank" rel="noopener noreferrer" download>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Ver gráfica
                </a>
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Para (correo del proveedor)</Label>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={ev.correo || 'proveedor@correo.com'}
              />
              {!hasEmail && (
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Este proveedor no tenía correo guardado. Escríbelo aquí para incluirlo en el EML.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-slate-600">Mensaje</Label>
                <Button size="sm" variant="ghost" onClick={handleCopyBody} className="h-6 text-xs">
                  {copied ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Copiado</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1" /> Copiar</>
                  )}
                </Button>
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-mono text-xs" />
            </div>

            {downloaded && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">EML descargado correctamente</p>
                  <p className="text-xs mt-0.5">
                    Ábrelo con doble clic desde tu carpeta de descargas. Se abrirá en tu cliente de correo con el PDF y la gráfica adjuntos, listo para enviar.
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{error}</div>
            )}

            <DialogFooter className="mt-2">
              <Button
                onClick={handleDownloadEml}
                disabled={downloading || !to.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {downloading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando EML…</>
                ) : (
                  <><FileDown className="w-4 h-4 mr-2" /> Descargar EML</>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ---------- Option B: WhatsApp ---------- */}
          <TabsContent value="whatsapp" className="space-y-3 mt-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                ¿Cómo funciona el WhatsApp?
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-emerald-800 text-[13px]">
                <li>Verifica el <strong>número</strong> del proveedor abajo (formato internacional, ej. <code>+52 614 123 4567</code>).</li>
                <li>Pulsa <strong>&ldquo;Abrir WhatsApp&rdquo;</strong>. Se abrirá WhatsApp Web o la app con el mensaje ya cargado.</li>
                <li>Descarga el PDF y la gráfica con los botones y <strong>adjúntalos manualmente</strong> en el chat antes de enviar.</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default" className="bg-slate-900 hover:bg-slate-800">
                <a href={`/api/evaluations/${ev.id}/pdf?withChart=1`} target="_blank" rel="noopener noreferrer" download>
                  <FileText className="w-4 h-4 mr-2" />
                  Descargar PDF
                </a>
              </Button>
              <Button asChild size="sm" variant="default" className="bg-emerald-700 hover:bg-emerald-800">
                <a href={`/api/evaluations/${ev.id}/chart`} target="_blank" rel="noopener noreferrer" download>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Descargar gráfica
                </a>
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">
                <Phone className="w-3 h-3 inline mr-1" />
                Teléfono del proveedor
              </Label>
              <Input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder={ev.telefono || '+52 614 123 4567'}
              />
              {!hasPhone && (
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Este proveedor no tiene teléfono guardado. Agrégalo en la evaluación (Editar) o escríbelo aquí.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-slate-600">Mensaje</Label>
                <Button size="sm" variant="ghost" onClick={handleCopyBody} className="h-6 text-xs">
                  {copied ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Copiado</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1" /> Copiar</>
                  )}
                </Button>
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono text-xs" />
            </div>

            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{error}</div>
            )}

            <DialogFooter className="mt-2">
              <Button asChild
                disabled={!telefono.trim()}
                className={cn(
                  'bg-[#25D366] hover:bg-[#1da851] text-white',
                  !telefono.trim() && 'opacity-50 pointer-events-none'
                )}
              >
                <a
                  href={telefono.trim() ? buildWhatsAppHref(telefono, body) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (telefono.trim()) {
                      // The user clicked "Abrir WhatsApp" — mark this evaluation
                      // as enviado via WhatsApp so the green badge appears.
                      // Use fetch in the background; don't block navigation.
                      fetch(`/api/evaluations/${ev.id}/mark-sent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tipo: 'WHATSAPP' }),
                      }).catch(() => {})
                      onSent?.('WHATSAPP')
                    }
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Abrir WhatsApp
                </a>
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-800 truncate">{value}</div>
    </div>
  )
}

function buildDefaultBody(ev: Evaluation, evaluador: string, cargo: string): string {
  return `Estimado equipo de ${ev.proveedor},

Les compartimos los resultados de la evaluación de desempeño como proveedor, realizada el ${formatDate(ev.fecha)}.

RESUMEN DE LA EVALUACIÓN
- Proveedor: ${ev.proveedor}
- Calificación final: ${ev.calificacion.toFixed(1)} / 100
- Clasificación: ${ev.clasificacion}
- Total de puntos: ${ev.total} / 40

Les adjuntamos:
1. El reporte completo en PDF con el detalle por criterio.
2. Una gráfica comparativa que muestra la posición de ${ev.proveedor} frente a los demás proveedores evaluados.

${ev.observaciones && ev.observaciones.trim() !== ''
    ? `OBSERVACIONES:\n${ev.observaciones}\n`
    : 'Sin observaciones.\n'
  }
Quedamos atentos a sus comentarios y a continuar trabajando en la mejora continua.

Saludos cordiales,
${evaluador}
${cargo}`
}

function formatDate(s: string): string {
  if (!s) return ''
  if (s.includes('-')) {
    const [y, m, d] = s.slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return s
}
