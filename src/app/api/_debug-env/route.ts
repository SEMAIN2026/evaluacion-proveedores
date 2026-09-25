import { NextResponse } from 'next/server'

/**
 * TEMPORARY DEBUG ENDPOINT — shows what env vars are actually present at
 * runtime so we can diagnose why the DB connection is going to the wrong
 * place. Safe to delete after debugging is complete.
 */
export async function GET() {
  const safe: Record<string, string | null> = {}
  for (const key of [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'DATABASE_URL',
    'DATABASE_AUTH_TOKEN',
    'EVALUADOR_NOMBRE',
    'EVALUADOR_CARGO',
    'NODE_ENV',
    'VERCEL_ENV',
  ]) {
    const v = process.env[key]
    if (v === undefined) {
      safe[key] = 'UNDEFINED'
    } else if (v === '') {
      safe[key] = 'EMPTY'
    } else if (key.includes('TOKEN') || key.includes('SECRET')) {
      // Don't leak secrets — just show the length and first/last 4 chars
      safe[key] = `[len=${v.length}] ${v.slice(0, 4)}...${v.slice(-4)}`
    } else {
      safe[key] = v
    }
  }
  return NextResponse.json({
    env: safe,
    timestamp: new Date().toISOString(),
  })
}
