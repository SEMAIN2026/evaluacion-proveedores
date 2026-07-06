import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'semain-evaluacion-proveedores-secret-key-2026-change-in-prod'
)
const COOKIE_NAME = 'semain_token'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ authenticated: false })
    }
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const exp = payload.exp as number
    const now = Math.floor(Date.now() / 1000)
    const remaining = exp - now
    return NextResponse.json({
      authenticated: true,
      expiresIn: remaining,
      expiresAt: new Date(exp * 1000).toISOString(),
    })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}
