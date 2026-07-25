export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STAGES, STAGE_LABELS } from '@/lib/domain'
import { formatRelative } from '@/lib/utils'
import { AdvanceButton } from './advance-button'

const PIPELINE_STAGES = [...STAGES.filter((s) => s !== 'awaiting_approval'), 'awaiting_approval', 'rejected'] as string[]

export default async function ProductionPage() {
  const items = await prisma.contentItem.findMany({
    where: { stage: { notIn: ['approved', 'published'] } },
    include: { topic: true, events: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  })
  const byStage = new Map<string, typeof items>()
  for (const s of PIPELINE_STAGES) byStage.set(s, [])
  for (const item of items) {
    if (!byStage.has(item.stage)) byStage.set(item.stage, [])
    byStage.get(item.stage)!.push(item)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">生产中</h1>
        <p className="text-sm text-gray-500 mt-1">
          流水线:研究 → 脚本 → 分镜 → 图片 → 配音 → 合成 → 质检 → 审批。可手动逐段推进,也可由 n8n 自动推进。
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {PIPELINE_STAGES.map((stage) => {
          const list = byStage.get(stage) ?? []
          return (
            <Card key={stage} className={list.length === 0 ? 'opacity-60' : ''}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{STAGE_LABELS[stage] ?? stage}</span>
                  <span className="text-xs font-normal text-gray-400">{list.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {list.map((item) => {
                  const lastEvent = item.events[0]
                  const failed = lastEvent?.status === 'failed'
                  return (
                    <div key={item.id} className="rounded-md border p-3 space-y-2 bg-white">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
                      <p className="text-xs text-gray-400">{formatRelative(item.stageEnteredAt)}</p>
                      {failed && (
                        <p className="text-xs text-red-500 line-clamp-3">{lastEvent.error}</p>
                      )}
                      {stage !== 'awaiting_approval' && stage !== 'rejected' && (
                        <AdvanceButton id={item.id} />
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
