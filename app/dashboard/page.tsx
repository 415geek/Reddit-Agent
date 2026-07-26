export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Factory, CheckCircle2, Send, Eye } from 'lucide-react'
import { STAGE_LABELS } from '@/lib/domain'
import { cn, formatRelative } from '@/lib/utils'
import { ProductionChart } from './production-chart'

export default async function OverviewPage() {
  const [topicPool, inProduction, awaitingApproval, published, observing, recentEvents, recentItems] = await Promise.all([
    prisma.topic.count({ where: { status: { in: ['idea', 'scored'] } } }),
    prisma.contentItem.count({ where: { stage: { in: ['research', 'script', 'storyboard', 'assets', 'voiceover', 'compose', 'qc'] } } }),
    prisma.contentItem.count({ where: { stage: 'awaiting_approval' } }),
    prisma.contentItem.count({ where: { stage: 'published' } }),
    prisma.publication.count({ where: { publishedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.pipelineEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { contentItem: true } }),
    prisma.contentItem.findMany({ orderBy: { updatedAt: 'desc' }, take: 8, include: { topic: true } }),
  ])

  // 近7天各日产出(进入待审批的数量)
  const since = new Date(Date.now() - 7 * 86400000)
  const produced = await prisma.contentItem.findMany({
    where: { producedAt: { gte: since } },
    select: { producedAt: true },
  })
  const byDay = new Map<string, number>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    byDay.set(d.toISOString().slice(5, 10), 0)
  }
  for (const p of produced) {
    if (!p.producedAt) continue
    const key = p.producedAt.toISOString().slice(5, 10)
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1)
  }
  const chartData = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">总览</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">内容工厂运行状态 · 85% 自动生产 + 15% 人工审批</p>
      </div>

      {/* 五个指标在窄屏排 2 列会剩一个孤零零的,改成横滑一排,一屏看到两个半、提示还有更多 */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto scroll-touch snap-x-cards pb-1 sm:pb-0 sm:overflow-visible [&>*]:w-[42%] [&>*]:flex-shrink-0 [&>*]:snap-card sm:[&>*]:w-auto">
        <StatCard title="选题池" value={topicPool} icon={<Lightbulb className="w-6 h-6" />} color="yellow" />
        <StatCard title="制作中" value={inProduction} icon={<Factory className="w-6 h-6" />} color="blue" />
        <StatCard title="待审批" value={awaitingApproval} icon={<CheckCircle2 className="w-6 h-6" />} color="red" />
        <StatCard title="已发布" value={published} icon={<Send className="w-6 h-6" />} color="green" />
        <StatCard title="近7天发布" value={observing} icon={<Eye className="w-6 h-6" />} color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">近7天产出(到达待审批)</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">最新内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentItems.length === 0 && <p className="text-sm text-gray-400">还没有生产任务。去选题库把选题入队。</p>}
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400">{formatRelative(item.updatedAt)}</p>
                </div>
                <Badge variant={item.stage === 'awaiting_approval' ? 'high' : item.stage === 'published' ? 'low' : 'default'}>
                  {STAGE_LABELS[item.stage] ?? item.stage}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">流水线事件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentEvents.length === 0 && <p className="text-sm text-gray-400">暂无事件。</p>}
          {recentEvents.map((e) => (
            // 一行五段在手机上必然挤成一团:窄屏改成两行——上行状态点+阶段+时间,下行标题
            <div key={e.id} className="flex items-start gap-2.5 text-sm">
              <span
                className={cn(
                  'leading-5 flex-shrink-0',
                  e.status === 'failed' ? 'text-red-500' : e.status === 'succeeded' ? 'text-green-600' : 'text-gray-400',
                )}
              >
                ●
              </span>
              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                <span className="text-gray-600 text-xs sm:text-sm sm:w-24 sm:flex-shrink-0">
                  {STAGE_LABELS[e.stage] ?? e.stage}
                  <span className="sm:hidden text-gray-400"> · {formatRelative(e.createdAt)}</span>
                </span>
                <span className="block sm:flex-1 text-gray-900 truncate">{e.contentItem?.title ?? '—'}</span>
                {e.error && <span className="block sm:max-w-xs text-xs text-red-500 truncate">{e.error}</span>}
                <span className="hidden sm:block text-xs text-gray-400 flex-shrink-0">{formatRelative(e.createdAt)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
