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

  // 入队即建生产单元。kind 按选题出身定:挂着采集素材的是图文,老的种子选题是视频。
  // 不能靠 schema 的默认值——默认是 note,把一条视频选题入队会走错阶段机
  if (status === 'queued') {
    const kind = topic.source === 'source_item' ? 'note' : 'video'
    const item = await prisma.contentItem.create({ data: { topicId: topic.id, title: topic.title, kind } })
    await prisma.topic.update({ where: { id: topic.id }, data: { status: 'in_production' } })
    return NextResponse.json({ ok: true, topic: { id: topic.id, status: 'in_production' }, itemId: item.id, kind })
  }
  return NextResponse.json({ ok: true, topic: { id: topic.id, status: topic.status } })
}
