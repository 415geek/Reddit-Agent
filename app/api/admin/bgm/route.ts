import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { prisma } from '@/lib/prisma'
import { BGM_LIBRARY_KEY, readBgmLibrary } from '@/lib/bgm'
import { BGM_MOODS } from '@/lib/domain'

export const dynamic = 'force-dynamic'

/** 查当前曲库 */
export async function GET(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, library: await readBgmLibrary() })
}

/**
 * 登记曲库。曲子本身由 scripts/build-bgm-library.mjs 直传存储,
 * 这里只记下"哪种情绪有哪几首"。
 * body: { library: { suspense: ["bgm/suspense-1.mp3"], ... } }
 */
export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  const body = (await req.json()) as { library?: Record<string, string[]> }
  const incoming = body.library ?? {}

  const library: Record<string, string[]> = {}
  for (const mood of BGM_MOODS) {
    const tracks = incoming[mood]
    if (Array.isArray(tracks) && tracks.length) library[mood] = tracks.filter((t) => typeof t === 'string')
  }
  if (!Object.keys(library).length) {
    return NextResponse.json({ ok: false, error: `曲库为空,情绪只能是 ${BGM_MOODS.join('|')}` }, { status: 400 })
  }

  await prisma.setting.upsert({
    where: { key: BGM_LIBRARY_KEY },
    update: { value: library },
    create: { key: BGM_LIBRARY_KEY, value: library },
  })
  return NextResponse.json({ ok: true, library, tracks: Object.values(library).flat().length })
}
