import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS, REGION_LABELS, TOPIC_STATUS_LABELS } from '@/lib/domain'
import { TopicActions } from './topic-actions'

export interface TopicRow {
  id: string
  title: string
  hook: string | null
  category: string
  region: string
  status: string
  scoreTotal: number | null
  riskFlags: string[]
  series: { name: string } | null
}

export function statusVariant(status: string) {
  if (status === 'rejected' || status === 'retired') return 'high'
  if (status === 'in_production' || status === 'queued') return 'medium'
  if (status === 'published') return 'low'
  return 'none'
}

/**
 * 手机上的选题卡片。七列的表格在 393px 上就算能横滑也没法用——
 * 要左右拖着才能把"标题"和"入队"按钮对上,滑一下就错行。
 * 卡片把同一条选题的信息收在一块,按钮直接落在标题下面。
 */
export function TopicCard({ topic }: { topic: TopicRow }) {
  return (
    <div className="p-4 border-b last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-gray-900 text-[15px] leading-snug min-w-0">{topic.title}</p>
        <span className="text-lg font-bold text-gray-900 tabular-nums flex-shrink-0 leading-snug">
          {topic.scoreTotal != null ? topic.scoreTotal.toFixed(0) : '—'}
        </span>
      </div>
      {topic.hook && <p className="text-[13px] text-gray-500 mt-1 leading-snug">{topic.hook}</p>}
      {topic.riskFlags.length > 0 && <p className="text-xs text-red-500 mt-1">⚠ {topic.riskFlags.join(', ')}</p>}

      {/* 标签和按钮同一行:选题库要翻一百多条,每条省下的一行都是翻页速度 */}
      <div className="flex items-end justify-between gap-3 mt-2.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge variant={statusVariant(topic.status)}>{TOPIC_STATUS_LABELS[topic.status] ?? topic.status}</Badge>
          <Badge variant={topic.region === 'north_america' ? 'default' : 'none'}>
            {REGION_LABELS[topic.region] ?? topic.region}
          </Badge>
          <span className="text-xs text-gray-500">{CATEGORY_LABELS[topic.category] ?? topic.category}</span>
          {topic.series && <span className="text-xs text-gray-400 truncate">· {topic.series.name}</span>}
        </div>
        <TopicActions id={topic.id} status={topic.status} className="flex-shrink-0" />
      </div>
    </div>
  )
}
