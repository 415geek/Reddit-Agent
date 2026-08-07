import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/agents/events'

/** Phase 1 人工发布登记:抖音发完后回填链接 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const item = await prisma.contentItem.findUnique({ where: { id: params.id } })
  if (!item) return NextResponse.json({ error: 'ContentItem 不存在' }, { status: 404 })
  if (item.stage !== 'approved') return NextResponse.json({ error: `当前阶段是 ${item.stage},请先通过审批` }, { status: 400 })

  const pub = await prisma.publication.create({
    data: {
      contentItemId: item.id,
      platform: 'douyin',
      mode: 'manual',
      shareUrl: body.shareUrl || null,
      externalId: body.externalId || null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
    },
  })
  await prisma.contentItem.update({ where: { id: item.id }, data: { stage: 'published' } })
  await prisma.topic.update({ where: { id: item.topicId }, data: { status: 'published' } })
  await logEvent({ contentItemId: item.id, stage: 'publish', status: 'succeeded', detail: { mode: 'manual', shareUrl: body.shareUrl } })
  return NextResponse.json({ ok: true, publicationId: pub.id })
}
