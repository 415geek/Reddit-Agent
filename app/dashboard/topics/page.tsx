export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CATEGORY_LABELS, REGION_LABELS, TOPIC_STATUS_LABELS } from '@/lib/domain'
import { TopicFilters } from './topic-filters'
import { RefillButton } from './refill-button'
import { TopicActions } from './topic-actions'
import { TopicCard, statusVariant } from './topic-card'

interface SearchParams {
  category?: string
  region?: string
  status?: string
}

export default async function TopicsPage({ searchParams }: { searchParams: SearchParams }) {
  const where: Record<string, unknown> = {}
  if (searchParams.category) where.category = searchParams.category
  if (searchParams.region) where.region = searchParams.region
  if (searchParams.status) where.status = searchParams.status

  const topics = await prisma.topic.findMany({
    where,
    include: { series: true },
    orderBy: [{ scoreTotal: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 200,
  })
  const total = await prisma.topic.count({ where })

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">选题库</h1>
            <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
              共 {total} 条 · 每天早上自动补货;不够就点「补题」,AI 全网搜一轮
            </p>
          </div>
          <RefillButton />
        </div>
      </div>

      <TopicFilters current={searchParams} />

      {/* 手机:卡片列表 */}
      <Card className="lg:hidden">
        <CardContent className="p-0">
          {topics.length === 0 && <p className="p-6 text-center text-sm text-gray-400">没有符合条件的选题。</p>}
          {topics.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </CardContent>
      </Card>

      {/* 桌面:表格 */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>选题</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>地区</TableHead>
                <TableHead>系列</TableHead>
                <TableHead>评分</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-md">
                    <p className="font-medium text-gray-900">{t.title}</p>
                    {t.hook && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.hook}</p>}
                    {t.riskFlags.length > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">⚠ {t.riskFlags.join(', ')}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{CATEGORY_LABELS[t.category] ?? t.category}</TableCell>
                  <TableCell>
                    <Badge variant={t.region === 'north_america' ? 'default' : 'none'}>
                      {REGION_LABELS[t.region] ?? t.region}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{t.series?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm font-semibold">
                    {t.scoreTotal != null ? t.scoreTotal.toFixed(0) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(t.status)}>{TOPIC_STATUS_LABELS[t.status] ?? t.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <TopicActions id={t.id} status={t.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
