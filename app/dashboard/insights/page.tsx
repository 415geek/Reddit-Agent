export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

const REC_LABELS: Record<string, { label: string; variant: 'low' | 'medium' | 'high' }> = {
  sequel: { label: '做续集', variant: 'low' },
  adjust: { label: '调整', variant: 'medium' },
  retire: { label: '停产', variant: 'high' },
}

export default async function InsightsPage() {
  const insights = await prisma.insight.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  const sequelTopics = await prisma.topic.findMany({
    where: { source: 'sequel' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">复盘</h1>
        <p className="text-sm text-gray-500 mt-1">
          每周AI复盘:只和账号自身基准比较,不看外部“爆款标准值”。续集选题自动进入选题池。
        </p>
      </div>

      {sequelTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">复盘生成的续集选题</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sequelTopics.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{t.title}</span>
                <Badge variant="none">{t.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {insights.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            还没有复盘记录。n8n 每周日触发,或手动 POST /api/pipeline/retrospective。
          </CardContent>
        </Card>
      )}

      {insights.map((ins) => {
        const recs = (ins.recommendations as Array<{ type: string; topicTitle: string; reason: string }>) || []
        return (
          <Card key={ins.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {formatDate(ins.periodStart)} — {formatDate(ins.periodEnd)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{ins.summary}</p>
              {recs.length > 0 && (
                <div className="space-y-1.5">
                  {recs.map((r, i) => {
                    const meta = REC_LABELS[r.type] ?? { label: r.type, variant: 'medium' as const }
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span className="font-medium">{r.topicTitle}</span>
                        <span className="text-gray-500">{r.reason}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
