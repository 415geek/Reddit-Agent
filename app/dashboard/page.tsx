export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Factory, CheckCircle2, Send, Eye } from 'lucide-react'
import { STAGE_LABELS } from '@/lib/domain'
import { formatRelative } from '@/lib/utils'
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
        <h1 className="text-2xl font-bold text-gray-900">总览</h1>
        <p className="text-sm text-gray-500 mt-1">内容工厂运行状态 · 85% 自动生产 + 15% 人工审批</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="选题池" value={topicPool} icon={<Lightbulb className="w-6 h-6" />} color="yellow" />
        <StatCard title="制作中" value={inProduction} icon={<Factory className="w-6 h-6" />} color="blue" />
        <StatCard title="待审批" value={awaitingApproval} icon={<CheckCircle2 className="w-6 h-6" />} color="red" />
        <StatCard title="已发布" value={published} icon={<Send className="w-6 h-6" />} color="green" />
        <StatCard title="近7天发布" value={observing} icon={<Eye className="w-6 h-6" />} color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
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
            <div key={e.id} className="flex items-center gap-3 text-sm">
              <span
                className={
                  e.status === 'failed' ? 'text-red-500' : e.status === 'succeeded' ? 'text-green-600' : 'text-gray-400'
                }
              >
                ●
              </span>
              <span className="text-gray-600 w-24 flex-shrink-0">{STAGE_LABELS[e.stage] ?? e.stage}</span>
              <span className="text-gray-900 truncate flex-1">{e.contentItem?.title ?? '—'}</span>
              {e.error && <span className="text-xs text-red-500 truncate max-w-xs">{e.error}</span>}
              <span className="text-xs text-gray-400 flex-shrink-0">{formatRelative(e.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
