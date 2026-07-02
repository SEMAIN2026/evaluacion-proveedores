'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Evaluation } from '@/lib/db'

interface Stats {
  total: number
  average: number
  max: number
  min: number
  distribution: Record<string, { count: number; avg: number }>
  top5: Array<{ id: string; proveedor: string; calificacion: number; clasificacion: string; fecha: string }>
  bottom5: Array<{ id: string; proveedor: string; calificacion: number; clasificacion: string; fecha: string }>
  withEmail: number
  withoutEmail: number
}

export function useEvaluations() {
  const [data, setData] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/evaluations', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (payload: Partial<Evaluation> & { proveedor: string }) => {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al guardar' }))
        throw new Error(err.error || 'Error al guardar')
      }
      const json = await res.json()
      await refresh()
      return json.data as Evaluation
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/evaluations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      await refresh()
    },
    [refresh]
  )

  return { data, loading, error, refresh, save, remove }
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setStats(json.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, loading, refresh }
}
