import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { readAsset, saveAsset, signedAssetUrl, usingSupabaseStorage } from '@/lib/storage'
import { buildZip, type ZipEntry } from '@/lib/zip'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 一键打包:整组卡片 PNG + 文案.txt,一个 zip 全拿走。
 * 老板发一条笔记要的所有东西都在里面,不用一张张长按保存。
 *
 * Supabase 后端下走"存一份 → 302 到签名直链":函数响应体上限 4.5MB,
 * 六张卡 ~10MB 直接吐会被掐;自托管(本地磁盘)没这个限制,直接流出去。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get('token')
  const viaToken = Boolean(token && process.env.N8N_WEBHOOK_SECRET && token === process.env.N8N_WEBHOOK_SECRET)
  if (!viaToken && !(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: params.id },
    include: { notes: { orderBy: { version: 'desc' }, take: 1 }, assets: true },
  })
  const note = item?.notes[0]
  if (!item || !note) return NextResponse.json({ error: '找不到笔记' }, { status: 404 })

  const cards = item.assets
    .filter((a) => a.kind === 'card_final')
    .sort((a, b) => (a.shotIndex ?? 0) - (b.shotIndex ?? 0))

  const entries: ZipEntry[] = []
  for (const c of cards) {
    entries.push({ name: `${String((c.shotIndex ?? 0) + 1).padStart(2, '0')}.png`, data: Buffer.from(await readAsset(c.path)) })
  }
  const text = [
    note.noteTitle,
    '',
    note.bodyText,
    '',
    note.hashtags.map((h) => `#${h}`).join(' '),
  ].join('\n')
  entries.push({ name: '文案.txt', data: Buffer.from(text, 'utf8') })

  const zip = buildZip(entries)

  if (usingSupabaseStorage()) {
    const rel = `items/${item.id}/cards.zip`
    await saveAsset(rel, zip)
    const url = await signedAssetUrl(rel, 3600)
    if (url) return NextResponse.redirect(url, 302)
    // 签名失败就退回直接吐——小于 4.5MB 的还能活
  }

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="cards-${item.id.slice(-6)}.zip"`,
    },
  })
}
