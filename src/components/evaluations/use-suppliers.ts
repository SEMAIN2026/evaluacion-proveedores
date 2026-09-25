'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Supplier } from '@/lib/evaluations'

/**
 * Fetches the full suppliers list once on mount, then exposes helpers to:
 *   - search the in-memory list by prefix (case-insensitive)
 *   - look up a single supplier by exact nombre
 *   - manually refresh from the server
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suppliers', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setSuppliers(json.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const search = useCallback(
    (q: string): Supplier[] => {
      const needle = q.trim().toLowerCase()
      if (!needle) return suppliers.slice(0, 50)
      return suppliers
        .filter((s) => s.nombre.toLowerCase().includes(needle))
        .slice(0, 50)
    },
    [suppliers]
  )

  const findByName = useCallback(
    (nombre: string): Supplier | undefined => {
      const n = nombre.trim().toLowerCase()
      if (!n) return undefined
      return suppliers.find((s) => s.nombre.toLowerCase() === n)
    },
    [suppliers]
  )

  return { suppliers, loading, error, refresh, search, findByName }
}
