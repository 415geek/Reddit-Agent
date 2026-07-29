export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NOTE_STAGES, NoteCard } from '@/lib/domain'
import { formatRelative } from '@/lib/utils'
import { AutoRunner } from './auto-runner'

/**
 * 生产页,图文专用。这一页没有任何"推进"按钮——
 * 打开页面的那一刻每个在产条目就自己开始跑(AutoRunner),
 * 跑完自动进审批。老板在这一页唯一的动作是"看一眼进度"。
 *
 * 视频那条线已停用,不再按八个阶段铺一屏卡片;
 * 还压在库里的视频条目收进底部一行,免得占地方。
 */

function cardProgress(item: { notes: { cards: unknown }[]; assets: { kind: string }[] }) {
  const cards = (item.notes[0]?.cards ?? []) as NoteCard[]
  if (!cards.length) return null
  const done = item.assets.filter((a) => a.kind === 'card_final').length
  return { done, total: cards.length, ratio: done / cards.length }
}

export default async function ProductionPage() {
  const inFlightStages = NOTE_STAGES.filter((s) => s !== 'awaiting_approval') as string[]
  const [inFlight, awaiting, rejected, videoCount] = await Promise.all([
    prisma.contentItem.findMany({
      where: { kind: 'note', stage: { in: inFlightStages } },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 1 },
        notes: { orderBy: { version: 'desc' }, take: 1, select: { cards: true } },
        assets: { select: { kind: true } },
      },
      orderBy: { stageEnteredAt: 'asc' },
    }),
    prisma.contentItem.findMany({
      where: { kind: 'note', stage: 'awaiting_approval' },
      orderBy: { producedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, producedAt: true },
    }),
    prisma.contentItem.findMany({
      where: { kind: 'note', stage: 'rejected' },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.contentItem.count({ where: { kind: 'video', stage: { notIn: ['approved', 'published', 'rejected'] } } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">生产中</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
          入队后全自动:核实 → 写稿 → 质检 → 出图渲卡。这一页不需要点任何东西,做完的自己进审批。
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>生成中</span>
            <span className="text-xs font-normal text-gray-400">{inFlight.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {inFlight.length === 0 && (
            <p className="py-6 text-center text-gray-400 text-sm">
              没有在产的内容。去
              <Link href="/dashboard/topics" className="text-orange-600 underline mx-1">
                选题库
              </Link>
              挑一条入队,剩下的全自动。
            </p>
          )}
          {inFlight.map((item) => {
            const lastEvent = item.events[0]
            const failed = lastEvent?.status === 'failed'
            const progress = cardProgress(item)
            return (
              <div key={item.id} className="rounded-md border p-3 space-y-2 bg-white">
                <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
                <p className="text-xs text-gray-400">{formatRelative(item.stageEnteredAt)}</p>
                {progress && (
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                  </div>
                )}
                {failed && <p className="text-xs text-red-500 line-clamp-2">{lastEvent.error}</p>}
                <AutoRunner id={item.id} stage={item.stage} />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>待审批(去复制发布)</span>
            <span className="text-xs font-normal text-gray-400">{awaiting.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {awaiting.length === 0 && <p className="py-4 text-center text-gray-400 text-sm">还没有做完的。</p>}
          {awaiting.map((item) => (
            <Link
              key={item.id}
              href="/dashboard/approvals"
              className="block rounded-md border p-3 bg-white hover:border-orange-300 transition"
            >
              <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
              <p className="text-xs text-green-600 mt-1">✓ 已生成 · 点击去审批页复制发布</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      {rejected.length > 0 && (
        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer">已拒绝({rejected.length})</summary>
          <div className="mt-2 space-y-1">
            {rejected.map((i) => (
              <p key={i.id} className="text-xs text-gray-400">
                {i.title} · {formatRelative(i.updatedAt)}
              </p>
            ))}
          </div>
        </details>
      )}

      {videoCount > 0 && (
        <p className="text-xs text-gray-400">
          另有 {videoCount} 条旧的短视频内容压在库里(视频线已停用,不再自动生产)。
        </p>
      )}
    </div>
  )
}
