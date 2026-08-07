import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { prisma } from '@/lib/prisma'
import { sendApprovalCard } from '@/lib/providers/telegram'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  const item = await prisma.contentItem.findUnique({
    where: { id: params.id },
    include: { topic: true, scripts: { orderBy: { version: 'desc' }, take: 1 } },
  })
  if (!item) return NextResponse.json({ error: 'ContentItem 不存在' }, { status: 404 })
  const result = await sendApprovalCard({
    itemId: item.id,
    title: item.title,
    hook: item.topic.hook ?? '',
    durationSec: item.scripts[0]?.durationEstSec ?? 90,
    coverLines: item.coverTitleLines,
    appUrl: process.env.FACTORY_APP_URL || 'http://localhost:3031',
  })
  return NextResponse.json({ ok: true, telegram: result })
}
