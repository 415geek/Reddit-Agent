import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { queueTopTopics } from '@/lib/agents/topics'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  const body = await req.json().catch(() => ({}))

  // 指定 topicId:手动把某个选题入产线;否则取评分头部 limit 个
  if (body.topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: body.topicId } })
    if (!topic) return NextResponse.json({ error: 'Topic 不存在' }, { status: 404 })
    const item = await prisma.contentItem.create({ data: { topicId: topic.id, title: topic.title } })
    await prisma.topic.update({ where: { id: topic.id }, data: { status: 'in_production' } })
    return NextResponse.json({ ok: true, items: [{ id: item.id, title: item.title }] })
  }

  const limit = Math.min(Number(body.limit) || 1, 10)
  const items = await queueTopTopics(limit)
  return NextResponse.json({ ok: true, items: items.map((i) => ({ id: i.id, title: i.title })) })
}
