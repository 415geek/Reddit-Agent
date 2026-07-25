'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export function PublishForm({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await fetch(`/api/items/${itemId}/publication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareUrl: url }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="抖音视频链接" className="w-64" />
      <Button size="sm" disabled={busy} onClick={submit}>登记发布</Button>
    </div>
  )
}

const FIELDS = [
  ['plays', '播放'],
  ['completionRate', '完播率(0-1)'],
  ['likes', '点赞'],
  ['favorites', '收藏'],
  ['shares', '分享'],
  ['comments', '评论'],
  ['followersDelta', '涨粉'],
] as const

export function MetricsForm({ publicationId, existing }: { publicationId: string; existing: number[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [atHours, setAtHours] = useState(existing.includes(24) ? (existing.includes(72) ? '168' : '72') : '24')
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await fetch(`/api/publications/${publicationId}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atHours: Number(atHours), ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) }),
      })
      setOpen(false)
      setValues({})
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + 录入数据快照
      </Button>
    )
  }

  return (
    <div className="rounded-md border bg-gray-50 p-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">时点</label>
          <Select value={atHours} onChange={(e) => setAtHours(e.target.value)} className="w-24 h-8 text-xs">
            <option value="24">24h</option>
            <option value="72">72h</option>
            <option value="168">168h</option>
          </Select>
        </div>
        {FIELDS.map(([key, label]) => (
          <div key={key}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <Input
              className="w-24 h-8 text-xs"
              value={values[key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>保存</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
      </div>
    </div>
  )
}
