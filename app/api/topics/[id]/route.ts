import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_STATUS = ['idea', 'scored', 'rejected', 'queued', 'retired']

/** 看板操作:修改选题状态(入队/淘汰/停产/恢复) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const status = String(body.status || '')
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: `status 必须是 ${ALLOWED_STATUS.join('|')}` }, { status: 400 })
  }
  const topic = await prisma.topic.update({ where: { id: params.id }, data: { status } })

  // 入队即建生产单元
  if (status === 'queued') {
    const item = await prisma.contentItem.create({ data: { topicId: topic.id, title: topic.title } })
    await prisma.topic.update({ where: { id: topic.id }, data: { status: 'in_production' } })
    return NextResponse.json({ ok: true, topic: { id: topic.id, status: 'in_production' }, itemId: item.id })
  }
  return NextResponse.json({ ok: true, topic: { id: topic.id, status: topic.status } })
}
