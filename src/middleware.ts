import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'semain-evaluacion-proveedores-secret-key-2026-change-in-prod'
)
const COOKIE_NAME = 'semain_token'

// Routes that DON'T require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/auth/check',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/downloads',
  '/assets',
  '/fonts',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for valid JWT in cookie
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return redirectToLogin(req)
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    // Token invalid or expired
    return redirectToLogin(req)
  }
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
