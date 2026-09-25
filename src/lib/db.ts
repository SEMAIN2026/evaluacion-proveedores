import { createClient, type Client } from '@libsql/client'

// Re-export everything that's safe for both server and client (types/constants/helpers)
// so existing imports `from '@/lib/db'` keep working in API routes.
export {
  type Evaluation,
  type Supplier,
  CRITERIA,
  SCORE_LABELS,
  classify,
  classificationColor,
  classificationBarColor,
  rowToEvaluation,
  rowToSupplier,
} from './evaluations'

/**
 * Turso (libSQL) client - works in dev (file:) and production (libsql:).
 * Falls back to local SQLite file when Turso env vars are missing.
 *
 * IMPORTANT: This module must ONLY be imported from server code
 * (API routes, server components, server actions). Importing it from a
 * client component will bundle @libsql/client (Node-only) into the browser.
 */
function createDbClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  if (tursoUrl && tursoToken) {
    return createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
  }

  // Local SQLite fallback
  const localUrl = process.env.DATABASE_URL || 'file:./db/local.db'
  return createClient({ url: localUrl })
}

const globalForDb = globalThis as unknown as {
  dbClient: Client | undefined
  __schemaEnsured?: boolean
}

export const db: Client = globalForDb.dbClient ?? createDbClient()

if (process.env.NODE_ENV !== 'production') globalForDb.dbClient = db

/**
 * Ensures the DB schema has the columns/tables introduced after the original
 * `evaluations` table. Idempotent — safe to call on every server start.
 *
 * Specifically:
 *   - ALTER TABLE evaluations ADD COLUMN telefono TEXT  (added 2026-09-25)
 *   - CREATE TABLE IF NOT EXISTS suppliers ...
 */
export async function ensureSchema(): Promise<void> {
  if (globalForDb.__schemaEnsured) return
  try {
    // 1) Add telefono column to evaluations (idempotent via try/catch)
    try {
      await db.execute(`ALTER TABLE evaluations ADD COLUMN telefono TEXT`)
    } catch (e) {
      // "duplicate column name: telefono" means it's already there — that's fine.
      const msg = e instanceof Error ? e.message : String(e)
      if (!/duplicate column name/i.test(msg)) {
        console.warn('[ensureSchema] ALTER evaluations add telefono:', msg)
      }
    }

    // 2) Create suppliers table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL,
        correo TEXT,
        telefono TEXT,
        evaluaciones_count INTEGER NOT NULL DEFAULT 0,
        ultima_evaluacion TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      )
    `)

    globalForDb.__schemaEnsured = true
  } catch (e) {
    console.error('[ensureSchema] FAILED:', e instanceof Error ? e.message : e)
    // Don't throw — let individual API routes fail with clearer errors if schema is genuinely broken.
  }
}
