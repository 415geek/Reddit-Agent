export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STAGES, STAGE_LABELS } from '@/lib/domain'
import { formatRelative } from '@/lib/utils'
import { AdvanceButton } from './advance-button'

const PIPELINE_STAGES = [...STAGES.filter((s) => s !== 'awaiting_approval'), 'awaiting_approval', 'rejected'] as string[]

/**
 * 图片资产阶段的进度。这一阶段一次推进只做够 40 秒的活,要十几轮才做得完,
 * 中间还有几轮是在等图生视频返回、什么都不产出——不把进度摆出来,
 * 卡片每轮都长得一模一样,只会让人以为卡死了。
 */
function assetProgress(item: {
  storyboards: { shots: unknown }[]
  assets: { kind: string }[]
}) {
  const shotList = (item.storyboards[0]?.shots ?? []) as Array<{ type?: string }>
  const shots = shotList.length
  if (!shots) return null
  const wantMotions = shotList.filter((s) => s.type === 'motion').length
  const images = item.assets.filter((a) => a.kind === 'shot_image').length
  const motions = item.assets.filter((a) => a.kind === 'motion_clip').length
  const total = shots + wantMotions
  const done = Math.min(images, shots) + Math.min(motions, wantMotions)
  return { shots, wantMotions, images, motions, remaining: Math.max(0, total - done), ratio: total ? done / total : 0 }
}

export default async function ProductionPage() {
  const items = await prisma.contentItem.findMany({
    where: { stage: { notIn: ['approved', 'published'] } },
    include: {
      topic: true,
      events: { orderBy: { createdAt: 'desc' }, take: 1 },
      // 资产阶段要能一眼看出做到哪了,不然卡片长得都一样,以为卡住了
      storyboards: { orderBy: { version: 'desc' }, take: 1 },
      assets: { select: { kind: true } },
    },
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">生产中</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
          流水线:研究 → 脚本 → 分镜 → 图片 → 配音 → 合成 → 质检 → 审批。可手动逐段推进,也可由 n8n 自动推进。
        </p>
      </div>

      {/* 手机单列:auto-fill 的 240px 最小宽在 393px 屏上只能排一列,还白白留一截空 */}
      <div className="grid gap-3 sm:gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
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
                  const progress = stage === 'assets' ? assetProgress(item) : null
                  return (
                    <div key={item.id} className="rounded-md border p-3 space-y-2 bg-white">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
                      <p className="text-xs text-gray-400">{formatRelative(item.stageEnteredAt)}</p>
                      {progress && (
                        <div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-orange-500 transition-all"
                              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            图 {progress.images}/{progress.shots} · 动态 {progress.motions}/{progress.wantMotions}
                            {progress.remaining > 0 ? ` · 还差 ${progress.remaining}` : ' · 已齐'}
                          </p>
                        </div>
                      )}
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
