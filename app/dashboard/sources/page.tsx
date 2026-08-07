export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SOURCE_CATEGORY_LABELS } from '@/lib/domain'

/**
 * 素材库:今天从各权威源采到了什么、哪些已经变成了选题。
 * 只读页面——采集和挑选题都是自动的(每日 cron),这页回答的是
 * "机器今天看到了什么、挑了什么、为什么没挑那些"。
 */

const STATUS_LABELS: Record<string, { text: string; variant: 'default' | 'outline' | 'none' }> = {
  new: { text: '待挑', variant: 'none' },
  shortlisted: { text: '已入选题', variant: 'default' },
  used: { text: '已成稿', variant: 'default' },
  skipped: { text: '略过', variant: 'outline' },
}

function timeAgo(d: Date | null) {
  if (!d) return ''
  const h = Math.round((Date.now() - d.getTime()) / 3600_000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h}小时前`
  return `${Math.round(h / 24)}天前`
}

export default async function SourcesPage() {
  const [feeds, items, counts] = await Promise.all([
    prisma.sourceFeed.findMany({ where: { active: true }, orderBy: { weight: 'desc' } }),
    prisma.sourceItem.findMany({
      orderBy: [{ publishedAt: 'desc' }],
      take: 80,
      include: { feed: { select: { name: true, weight: true } } },
    }),
    prisma.sourceItem.groupBy({ by: ['status'], _count: true }),
  ])
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">素材库</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
          每天从 {feeds.length} 个权威源自动采集。待挑 {countBy.new ?? 0} · 已入选题 {countBy.shortlisted ?? 0} · 已成稿{' '}
          {countBy.used ?? 0}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">源健康度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {feeds.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">
                    {SOURCE_CATEGORY_LABELS[f.category] ?? f.category} · 权重{f.weight}
                    {f.lastFetchedAt ? ` · ${timeAgo(f.lastFetchedAt)}采过` : ' · 还没采过'}
                  </p>
                </div>
                {f.lastError ? (
                  <Badge variant="outline" className="shrink-0 text-red-600 border-red-200">
                    出错
                  </Badge>
                ) : (
                  <Badge variant="none" className="shrink-0">
                    正常
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近素材</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          {items.map((it) => {
            const st = STATUS_LABELS[it.status] ?? STATUS_LABELS.new
            return (
              <div key={it.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-orange-600 leading-snug min-w-0"
                  >
                    {it.title}
                  </a>
                  <Badge variant={st.variant} className="shrink-0">
                    {st.text}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {it.source} · {SOURCE_CATEGORY_LABELS[it.category] ?? it.category}
                  {it.publishedAt ? ` · ${it.publishedAt.toISOString().slice(0, 10)}` : ''}
                  {it.rawText ? ' · 有全文' : ''}
                </p>
                {it.summary && <p className="text-[13px] text-gray-500 mt-1 line-clamp-2">{it.summary}</p>}
              </div>
            )
          })}
          {items.length === 0 && (
            <p className="py-8 text-center text-gray-400 text-sm">还没有素材。每日采集跑过之后这里会出现今天的收获。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
