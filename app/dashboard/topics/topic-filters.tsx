'use client'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { CATEGORY_LABELS, REGION_LABELS, TOPIC_STATUS_LABELS } from '@/lib/domain'

export function TopicFilters({ current }: { current: { category?: string; region?: string; status?: string } }) {
  const router = useRouter()

  function update(key: string, value: string) {
    const params = new URLSearchParams()
    const next = { ...current, [key]: value }
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
    router.push(`/dashboard/topics?${params.toString()}`)
  }

  return (
    <div className="flex gap-3 flex-wrap">
      <Select value={current.category ?? ''} onChange={(e) => update('category', e.target.value)} className="w-44">
        <option value="">全部分类</option>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </Select>
      <Select value={current.region ?? ''} onChange={(e) => update('region', e.target.value)} className="w-36">
        <option value="">全部地区</option>
        {Object.entries(REGION_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </Select>
      <Select value={current.status ?? ''} onChange={(e) => update('status', e.target.value)} className="w-36">
        <option value="">全部状态</option>
        {Object.entries(TOPIC_STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </Select>
    </div>
  )
}
