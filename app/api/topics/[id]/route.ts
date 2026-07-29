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

  // 入队即建生产单元。只有挂着采集素材的图文选题能入队——
  // 老的视频选题入队会创建一条永远没人推的视频条目(视频线停用、
  // 生产页也不显示),对用户来说就是"点了之后消失了"。直接拒绝,说清原因。
  if (status === 'queued') {
    if (topic.source !== 'source_item') {
      await prisma.topic.update({ where: { id: topic.id }, data: { status: 'retired' } })
      return NextResponse.json(
        { error: '这是旧视频线的选题,不能入队生产图文。图文选题由每日采集自动生成,请从带来源的选题里挑。' },
        { status: 400 },
      )
    }
    const kind = 'note'
    const item = await prisma.contentItem.create({ data: { topicId: topic.id, title: topic.title, kind } })
    await prisma.topic.update({ where: { id: topic.id }, data: { status: 'in_production' } })
    return NextResponse.json({ ok: true, topic: { id: topic.id, status: 'in_production' }, itemId: item.id, kind })
  }
  return NextResponse.json({ ok: true, topic: { id: topic.id, status: topic.status } })
}
