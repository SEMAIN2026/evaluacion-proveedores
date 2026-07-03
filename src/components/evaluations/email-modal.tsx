'use client'

import { useEffect, useState, useCallback } from 'react'
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
import {
  Loader2, Mail, ExternalLink, Copy, Download, Send, CheckCircle2,
  Mailbox, AlertCircle, ServerCog, FolderOpen, FileText, Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Evaluation } from '@/lib/evaluations'

interface Props {
  ev: Evaluation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluador: string
  cargo: string
}

const TRAY_URL = 'http://127.0.0.1:8765'

export function EmailModal({ ev, open, onOpenChange, evaluador, cargo }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [trayStatus, setTrayStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [trayResult, setTrayResult] = useState<string | null>(null)

  useEffect(() => {
    if (ev) {
      setTo(ev.correo || '')
      setSubject(`Evaluación de Proveedor - ${ev.proveedor} | Calificación: ${ev.calificacion.toFixed(1)} (${ev.clasificacion})`)
      setBody(buildDefaultBody(ev, evaluador, cargo))
      setSent(false)
      setError(null)
      setTrayResult(null)
    }
  }, [ev, evaluador, cargo])

  // Check if the Python tray app is running (localhost:8765)
  const checkTray = useCallback(async () => {
    setTrayStatus('checking')
    try {
      const res = await fetch(`${TRAY_URL}/status`, { method: 'GET', mode: 'cors' })
      if (res.ok) {
        setTrayStatus('online')
      } else {
        setTrayStatus('offline')
      }
    } catch {
      setTrayStatus('offline')
    }
  }, [])

  useEffect(() => {
    if (open) {
      checkTray()
    }
  }, [open, checkTray])

  if (!ev) return null

  const hasEmail = !!ev.correo
  const mailtoHref = buildMailto(to, subject, body)

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  // ----- Option A: Python tray app (the recommended way) -----
  const handlePrepareInTray = async () => {
    if (!hasEmail) {
      setError('Este proveedor no tiene correo electrónico')
      return
    }
    setSending(true)
    setError(null)
    setTrayResult(null)
    try {
      const res = await fetch(`${TRAY_URL}/prepare-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: ev.proveedor,
          email: to,
          subject,
          body,
          pdfUrl: `${window.location.origin}/api/evaluations/${ev.id}/pdf`,
          chartUrl: `${window.location.origin}/api/evaluations/${ev.id}/chart`,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al preparar el correo')
      }
      setTrayResult(json.savedTo || 'Archivos guardados y Outlook abierto')
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión con la app local')
    } finally {
      setSending(false)
    }
  }

  // ----- Option B: SMTP server-side send -----
  const handleSendSmtp = async () => {
    setSending(true)
    setError(null)
    setSent(false)
    try {
      const res = await fetch(`/api/evaluations/${ev.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, subject, body,
          attachPdf: true, attachChart: true,
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
            comparativa</strong> con todos los proveedores.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat label="Calificación" value={`${ev.calificacion.toFixed(1)}/100`} />
          <Stat label="Clasificación" value={ev.clasificacion} />
          <Stat label="Puntos" value={`${ev.total}/40`} />
          <Stat label="Fecha" value={formatDate(ev.fecha)} />
        </div>

        <Tabs defaultValue="tray" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tray">
              <Mailbox className="w-4 h-4 mr-2" />
              Outlook (app local)
            </TabsTrigger>
            <TabsTrigger value="mailto">
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir mi correo
            </TabsTrigger>
            <TabsTrigger value="smtp">
              <Send className="w-4 h-4 mr-2" />
              Enviar directo
            </TabsTrigger>
          </TabsList>

          {/* ---------- Option A: Python Tray App ---------- */}
          <TabsContent value="tray" className="space-y-3 mt-3">
            {trayStatus === 'checking' && (
              <div className="flex items-center gap-2 text-sm text-slate-500 p-3 bg-slate-50 rounded-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando si la app local está corriendo...
              </div>
            )}

            {trayStatus === 'online' && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  App local conectada — Outlook disponible
                </p>
                <p className="text-[13px] mb-3">
                  Al pulsar el botón, la app descarga el PDF y la gráfica, los guarda
                  en tu carpeta de evaluaciones por año y mes, y abre Outlook con
                  todo listo para enviar.
                </p>
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 rounded p-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Se guardará en: C:\Users\Equipo 39\Desktop\WALTER\ALMACEN\EVALUACION DE PROVEDORES\<strong>{new Date().getFullYear()}</strong>\<strong>{getMonthName()}</strong>\
                </div>
              </div>
            )}

            {trayStatus === 'offline' && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  La app local no está corriendo
                </p>
                <p className="text-[13px] mb-3">
                  Descarga la app de SEMAIN, instálala (una sola vez) y ejecútala.
                  Aparecerá un icono verde con "S" en la bandeja del sistema. Luego
                  vuelve a esta página y pulsa "Reintentar".
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button asChild size="sm" variant="default">
                    <a href="/downloads/semain_tray.py" download>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      1. semain_tray.py
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="default">
                    <a href="/downloads/instalar.bat" download>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      2. instalar.bat
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="/downloads/LEEME.md" target="_blank" rel="noopener noreferrer">
                      Instrucciones
                    </a>
                  </Button>
                </div>
                <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                  <li>Descarga los 2 archivos y ponlos en una carpeta (ej. <code>C:\SEMAIN\</code>)</li>
                  <li>Doble clic en <code>instalar.bat</code> (instala todo + crea acceso directo en el Escritorio, una sola vez)</li>
                  <li>Doble clic en el acceso directo "SEMAIN - Asistente" del Escritorio (verás el icono verde)</li>
                  <li>Vuelve aquí y pulsa "Reintentar"</li>
                </ol>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkTray}
                  className="mt-3"
                >
                  <ServerCog className="w-3.5 h-3.5 mr-1.5" />
                  Reintentar conexión
                </Button>
              </div>
            )}

            {/* Recipient / subject / body (editable) */}
            {trayStatus === 'online' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-600">Para</Label>
                  <Input
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    disabled={!hasEmail}
                  />
                  {!hasEmail && (
                    <p className="text-xs text-rose-600">Este proveedor no tiene correo. Agrégalo en "Editar".</p>
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
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>
              </>
            )}

            {sent && trayStatus === 'online' && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-semibold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Listo! Outlook abierto con todo preparado
                </p>
                {trayResult && (
                  <p className="text-xs text-emerald-700">
                    Archivos guardados en: {trayResult}
                  </p>
                )}
                <p className="text-xs text-emerald-700 mt-1">
                  Revisa el correo en Outlook y pulsa "Enviar".
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            {trayStatus === 'online' && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handlePrepareInTray}
                  disabled={sending || !hasEmail}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparando...</>
                  ) : (
                    <><Mailbox className="w-4 h-4 mr-2" /> Preparar en Outlook</>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ---------- Option B: mailto ---------- */}
          <TabsContent value="mailto" className="space-y-3 mt-3">
            <div className="rounded-md bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">
              <p className="font-semibold mb-1">¿Cómo funciona?</p>
              <ol className="list-decimal list-inside space-y-0.5 text-sky-800 text-[13px]">
                <li>Descarga el PDF y la gráfica con los botones de abajo.</li>
                <li>Pulsa <strong>&ldquo;Abrir mi correo&rdquo;</strong> para abrir Outlook/Gmail con el mensaje.</li>
                <li>Adjunta manualmente los dos archivos descargados y envía.</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default" className="bg-slate-900 hover:bg-slate-800">
                <a href={`/api/evaluations/${ev.id}/pdf`} target="_blank" rel="noopener noreferrer" download>
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
              <Label className="text-xs uppercase tracking-wide text-slate-600">Para</Label>
              <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={ev.correo || 'proveedor@correo.com'} />
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

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                <a href={mailtoHref}>
                  <Mail className="w-4 h-4 mr-2" />
                  Abrir mi correo
                </a>
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Option C: SMTP ---------- */}
          <TabsContent value="smtp" className="space-y-3 mt-3">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <p className="font-semibold mb-1">Requiere configuración SMTP</p>
              <p className="text-[13px]">
                Para enviar directo desde el servidor (sin abrir Outlook), configura
                las variables SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM en Vercel.
                Para Outlook 365 usa: <code className="bg-amber-100 px-1 rounded">smtp.office365.com</code> puerto <code className="bg-amber-100 px-1 rounded">587</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Para</Label>
              <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-600">Mensaje</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono text-xs" />
            </div>

            {sent && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Correo enviado correctamente a <strong>{to}</strong>.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{error}</div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleSendSmtp} disabled={sending || !to} className="bg-emerald-600 hover:bg-emerald-700">
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Enviar con PDF + gráfica</>
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
  return `mailto:${encodeURIComponent(to || '')}?${params.toString().replace(/\+/g, '%20').replace(/%0A/g, '%0D%0A')}`
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

function getMonthName(): string {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return months[new Date().getMonth()]
}
