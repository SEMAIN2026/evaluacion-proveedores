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
import { Badge } from '@/components/ui/badge'
import { Loader2, Mail, ExternalLink, Copy, Download, Send, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Evaluation } from '@/lib/db'

interface Props {
  ev: Evaluation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluador: string
  cargo: string
}

export function EmailModal({ ev, open, onOpenChange, evaluador, cargo }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ev) {
      setTo(ev.correo || '')
      setSubject(`Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`)
      setBody(buildDefaultBody(ev, evaluador, cargo))
      setSent(false)
      setError(null)
    }
  }, [ev, evaluador, cargo])

  if (!ev) return null

  // ----- Option A: mailto: link (opens user's email client) -----
  // The PDF and chart PNG must be downloaded separately because mailto: doesn't
  // support attachments. We make this crystal clear in the UI.
  const mailtoHref = buildMailto(to, subject, body)

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  // ----- Option B: server-side SMTP send -----
  const handleSendSmtp = async () => {
    setSending(true)
    setError(null)
    setSent(false)
    try {
      const res = await fetch(`/api/evaluations/${ev.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body,
          attachPdf: true,
          attachChart: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al enviar el correo')
      }
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setSending(false)
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
            El correo incluirá el <strong>PDF de evaluación</strong> y la <strong>gráfica
            comparativa</strong> con todos los proveedores (sin la tabla de detalle, solo la
            gráfica para que conozcan su posición).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat label="Calificación" value={`${ev.calificacion.toFixed(1)}/100`} />
          <Stat label="Clasificación" value={ev.clasificacion} />
          <Stat label="Puntos" value={`${ev.total}/40`} />
          <Stat label="Fecha" value={formatDate(ev.fecha)} />
        </div>

        <Tabs defaultValue="mailto" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mailto">
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir mi correo
            </TabsTrigger>
            <TabsTrigger value="smtp">
              <Send className="w-4 h-4 mr-2" />
              Enviar directo (SMTP)
            </TabsTrigger>
          </TabsList>

          {/* ---------- Option A: mailto ---------- */}
          <TabsContent value="mailto" className="space-y-3 mt-3">
            <div className="rounded-md bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">
              <p className="font-semibold mb-1">¿Cómo funciona?</p>
              <ol className="list-decimal list-inside space-y-0.5 text-sky-800 text-[13px]">
                <li>Descarga el PDF y la gráfica con los botones de abajo.</li>
                <li>Pulsa <strong>&ldquo;Abrir mi correo&rdquo;</strong> para abrir Outlook / Gmail / Apple Mail con el mensaje ya redactado.</li>
                <li>Adjunta manualmente los dos archivos descargados y envía.</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default" className="bg-slate-900 hover:bg-slate-800">
                <a
                  href={`/api/evaluations/${ev.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </a>
              </Button>
              <Button asChild size="sm" variant="default" className="bg-emerald-700 hover:bg-emerald-800">
                <a
                  href={`/api/evaluations/${ev.id}/chart`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar gráfica
                </a>
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Para</Label>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={ev.correo || 'proveedor@correo.com'}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-slate-600">Mensaje</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyBody}
                  className="h-6 text-xs"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <Button
                asChild
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <a href={mailtoHref}>
                  <Mail className="w-4 h-4 mr-2" />
                  Abrir mi correo
                </a>
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Option B: SMTP ---------- */}
          <TabsContent value="smtp" className="space-y-3 mt-3">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <p className="font-semibold mb-1">Requiere configuración SMTP</p>
              <p className="text-[13px]">
                Para usar esta opción, configura estas variables de entorno en tu
                despliegue:
                <code className="block mt-1 p-2 bg-amber-100 rounded text-xs">
                  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
                </code>
                Con Gmail usa una <strong>App Password</strong> (no tu contraseña normal).
                Si no está configurado, usa la pestaña <strong>&ldquo;Abrir mi correo&rdquo;</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Para</Label>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Mensaje</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>

            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <strong>Adjuntos automáticos:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Evaluacion-{ev.proveedor}.pdf</li>
                <li>Grafica-comparativa-{ev.proveedor}.png</li>
              </ul>
            </div>

            {sent && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Correo enviado correctamente a <strong>{to}</strong>.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSendSmtp}
                disabled={sending || !to}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar con PDF + gráfica
                  </>
                )}
              </Button>
            </div>
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

function buildMailto(to: string, subject: string, body: string): string {
  const params = new URLSearchParams()
  if (to) params.set('to', to)
  params.set('subject', subject)
  params.set('body', body)
  // Append cc support if needed
  // Use mailto: with URL-encoded params; line breaks become %0D%0A
  return `mailto:${encodeURIComponent(to || '')}?${params
    .toString()
    .replace(/\+/g, '%20')
    .replace(/%0A/g, '%0D%0A')}`
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
