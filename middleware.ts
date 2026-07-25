import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',
  // n8n webhook 路由:自身用 x-webhook-secret 校验(middleware 不拦,路由内必须校验)
  '/api/pipeline',
  '/api/hooks',
  // 资产与封面渲染:路由内校验 cookie 或 token
  '/api/assets',
  '/covers',
]

async function verifyJwt(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
  await jwtVerify(token, secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    // 看板 API:接受 Bearer JWT 或登录 cookie
    const auth = request.headers.get('authorization')
    const cookieToken = request.cookies.get('bb_token')?.value
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : cookieToken
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      await verifyJwt(token)
      return NextResponse.next()
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  }

  const token = request.cookies.get('bb_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))
  try {
    await verifyJwt(token)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('bb_token')
    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/((?!auth).*)'],
}
