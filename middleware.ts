import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/api/')) {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
      await jwtVerify(auth.slice(7), secret)
      return NextResponse.next()
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  }
  const token = request.cookies.get('mv_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('mv_token')
    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/((?!auth).*)'],
}
