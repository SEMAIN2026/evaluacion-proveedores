import { createClient, type Client } from '@libsql/client'

// Re-export everything that's safe for both server and client (types/constants/helpers)
// so existing imports `from '@/lib/db'` keep working in API routes.
export {
  type Evaluation,
  CRITERIA,
  SCORE_LABELS,
  classify,
  classificationColor,
  classificationBarColor,
  rowToEvaluation,
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

const globalForDb = globalThis as unknown as { dbClient: Client | undefined }

export const db: Client = globalForDb.dbClient ?? createDbClient()

if (process.env.NODE_ENV !== 'production') globalForDb.dbClient = db
