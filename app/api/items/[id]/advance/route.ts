import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { advanceItem } from '@/lib/agents/pipeline'
import { advanceNoteItem } from '@/lib/agents/note-pipeline'

export const maxDuration = 60

/**
 * 看板手动推进一个阶段。
 *
 * 必须按 kind 分发。图文和视频的阶段名有重合(research/qc),
 * 图文条目丢进视频的阶段机不会报错——它会安静地走进视频的 research,
 * 往 Script/Storyboard 表里写东西,而 Note 表里什么都不会出现,
 * 表面上"推进成功了",实际产的全是另一条线的半成品。
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const item = await prisma.contentItem.findUnique({ where: { id: params.id }, select: { kind: true } })
    if (!item) return NextResponse.json({ ok: false, error: '不存在' }, { status: 404 })
    const result =
      item.kind === 'video'
        ? await advanceItem(params.id)
        : await advanceNoteItem(params.id, { budgetMs: 40_000 })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, itemId: params.id, error: String(e) }, { status: 500 })
  }
}
