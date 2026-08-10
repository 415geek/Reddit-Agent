import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const adminUser = process.env.MARKETVOICE_ADMIN_USER || 'admin'
  const adminPass = process.env.MARKETVOICE_ADMIN_PASSWORD || 'changeme'

  if (username !== adminUser || password !== adminPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken({ sub: username, role: 'admin' })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('mv_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
