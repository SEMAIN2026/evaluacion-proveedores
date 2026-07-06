'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const eyeRef = useRef<SVGSVGElement>(null)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!eyeRef.current) return
    const rect = eyeRef.current.getBoundingClientRect()
    const eyeCenterX = rect.left + rect.width / 2
    const eyeCenterY = rect.top + rect.height / 2
    const dx = e.clientX - eyeCenterX
    const dy = e.clientY - eyeCenterY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxOffset = 7
    const angle = Math.atan2(dy, dx)
    const offsetMag = Math.min(dist / 30, maxOffset)
    setPupilOffset({
      x: Math.cos(angle) * offsetMag,
      y: Math.sin(angle) * offsetMag,
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  useEffect(() => {
    fetch('/api/auth/check', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace('/')
        }
      })
      .catch(() => {})
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
      } else {
        router.replace('/')
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const pupilX = showPassword ? 0 : pupilOffset.x
  const pupilY = showPassword ? -5 : pupilOffset.y

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A0CD50] to-[#7BA635] mb-4 shadow-lg shadow-emerald-900/50">
            <span className="text-4xl font-bold text-[#302C2B]">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">SEMAIN</h1>
          <p className="text-slate-400 text-sm">Evaluación de Proveedores · F-CAL-07 REV01</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                Contraseña de acceso
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa la contraseña"
                  className="pr-14 h-12 text-lg border-2 border-slate-200 focus:border-emerald-500"
                  autoFocus
                  autoComplete="off"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <svg
                    ref={eyeRef}
                    width="28"
                    height="28"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-slate-600 hover:text-emerald-600 transition-colors"
                  >
                    <path
                      d="M2 16 C 8 6, 24 6, 30 16 C 24 26, 8 26, 2 16 Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {!showPassword ? (
                      <>
                        <circle
                          cx={16 + pupilX}
                          cy={16 + pupilY}
                          r="5"
                          fill="currentColor"
                        />
                        <circle
                          cx={16 + pupilX - 1.5}
                          cy={16 + pupilY - 1.5}
                          r="1.2"
                          fill="white"
                        />
                      </>
                    ) : (
                      <line
                        x1="11"
                        y1="16"
                        x2="21"
                        y2="16"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-6">
            La sesión expira en 3 horas por seguridad
          </p>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          SEMAIN © 2026 · Sistema de Evaluación de Proveedores
        </p>
      </div>
    </div>
  )
}
