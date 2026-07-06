import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'semain_token'

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
