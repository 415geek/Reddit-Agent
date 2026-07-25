'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function TopicActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(next: string) {
    setBusy(true)
    try {
      await fetch(`/api/topics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'in_production' || status === 'published') return null

  return (
    <div className="flex gap-1.5">
      {(status === 'idea' || status === 'scored') && (
        <>
          <Button size="sm" disabled={busy} onClick={() => setStatus('queued')}>入队</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('rejected')}>淘汰</Button>
        </>
      )}
      {(status === 'rejected' || status === 'retired') && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('idea')}>恢复</Button>
      )}
    </div>
  )
}
