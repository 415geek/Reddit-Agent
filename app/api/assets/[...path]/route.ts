import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { readAsset } from '@/lib/storage'

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.srt': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

/** 资产读取:登录 cookie 或 ?token=<N8N_WEBHOOK_SECRET>(供截图/合成 worker 用) */
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const tokenParam = req.nextUrl.searchParams.get('token')
  const cookieToken = req.cookies.get('bb_token')?.value
  let authorized = Boolean(tokenParam && process.env.N8N_WEBHOOK_SECRET && tokenParam === process.env.N8N_WEBHOOK_SECRET)
  if (!authorized && cookieToken) {
    try {
      await verifyToken(cookieToken)
      authorized = true
    } catch {}
  }
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rel = params.path.join('/')
  try {
    const buf = await readAsset(rel)
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase()
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
