import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const ACCESS_PASSWORD = '2026'
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'semain-evaluacion-proveedores-secret-key-2026-change-in-prod'
)
const TOKEN_EXPIRY = '3h'
const COOKIE_NAME = 'semain_token'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const password = String(body.password || '')

    if (password !== ACCESS_PASSWORD) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 }
      )
    }

    const token = await new SignJWT({ grant: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(JWT_SECRET)

    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3 * 60 * 60,
      path: '/',
    })

    return response
  } catch (e) {
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
