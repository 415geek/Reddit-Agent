'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AdvanceButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function advance() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/items/${id}/advance`, { method: 'POST' })
      const json = await res.json()
      if (!json.ok) setError(json.error || '失败')
      router.refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button size="sm" variant="outline" disabled={busy} onClick={advance} className="w-full">
        {busy ? '执行中…' : '推进下一阶段 ▶'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1 line-clamp-2">{error}</p>}
    </div>
  )
}
