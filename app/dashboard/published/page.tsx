export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { accountBaseline } from '@/lib/agents/retrospective'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/lib/domain'
import { formatDate } from '@/lib/utils'
import { PublishForm, MetricsForm } from './forms'

export default async function PublishedPage() {
  const [approvedItems, publications, baseline] = await Promise.all([
    prisma.contentItem.findMany({
      where: { stage: 'approved' },
      include: { topic: true },
      orderBy: { stageEnteredAt: 'asc' },
    }),
    prisma.publication.findMany({
      include: { contentItem: { include: { topic: true } }, metrics: { orderBy: { atHours: 'asc' } } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    }),
    accountBaseline(),
  ])

  const pct = (x: number | null | undefined) => (x != null ? `${(x * 100).toFixed(1)}%` : '—')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">已发布 · 数据</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
          Phase 1 人工发布:批准后到抖音发布(勾选AI内容声明),回来登记链接;24h/72h/168h 录入数据。
        </p>
      </div>

      {baseline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账号基准(全部快照均值,样本 {baseline.sampleSize})</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 text-sm">
            <div><p className="text-gray-400 text-xs">播放</p><p className="font-semibold">{baseline.avgPlays}</p></div>
            <div><p className="text-gray-400 text-xs">完播率</p><p className="font-semibold">{pct(baseline.avgCompletionRate)}</p></div>
            <div><p className="text-gray-400 text-xs">点赞率</p><p className="font-semibold">{pct(baseline.avgLikeRate)}</p></div>
            <div><p className="text-gray-400 text-xs">收藏率</p><p className="font-semibold">{pct(baseline.avgFavoriteRate)}</p></div>
            <div><p className="text-gray-400 text-xs">分享率</p><p className="font-semibold">{pct(baseline.avgShareRate)}</p></div>
            <div><p className="text-gray-400 text-xs">评论率</p><p className="font-semibold">{pct(baseline.avgCommentRate)}</p></div>
            <div><p className="text-gray-400 text-xs">千次涨粉</p><p className="font-semibold">{baseline.avgFollowersPer1k.toFixed(1)}</p></div>
          </CardContent>
        </Card>
      )}

      {approvedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">待发布({approvedItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvedItems.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:justify-between border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-400">{CATEGORY_LABELS[item.topic.category]} · 发布时片尾/简介注明「{item.publishNote}」</p>
                </div>
                <PublishForm itemId={item.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {publications.map((pub) => (
          <Card key={pub.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <CardTitle className="text-base">{pub.contentItem.title}</CardTitle>
                <div className="flex gap-2 items-center">
                  <Badge variant="none">{formatDate(pub.publishedAt)}</Badge>
                  {pub.shareUrl && (
                    <a href={pub.shareUrl} target="_blank" className="text-xs text-blue-600 hover:underline">
                      查看视频 ↗
                    </a>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pub.metrics.length > 0 && (
                <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scroll-touch">
                  <table className="text-sm w-full min-w-[520px]">
                    <thead>
                      <tr className="text-xs text-gray-400 text-left">
                        <th className="py-1 pr-4">时点</th><th className="pr-4">播放</th><th className="pr-4">完播率</th>
                        <th className="pr-4">点赞</th><th className="pr-4">收藏</th><th className="pr-4">分享</th>
                        <th className="pr-4">评论</th><th className="pr-4">涨粉</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pub.metrics.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="py-1.5 pr-4 font-medium">{m.atHours}h</td>
                          <td className="pr-4">{m.plays}</td>
                          <td className="pr-4">{pct(m.completionRate)}</td>
                          <td className="pr-4">{m.likes}</td>
                          <td className="pr-4">{m.favorites}</td>
                          <td className="pr-4">{m.shares}</td>
                          <td className="pr-4">{m.comments}</td>
                          <td className="pr-4">{m.followersDelta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <MetricsForm publicationId={pub.id} existing={pub.metrics.map((m) => m.atHours)} />
            </CardContent>
          </Card>
        ))}
        {publications.length === 0 && approvedItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">还没有发布记录。</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
