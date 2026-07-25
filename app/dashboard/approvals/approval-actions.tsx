'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function decide(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !confirm('确认拒绝这条内容?')) return
    setBusy(true)
    try {
      await fetch(`/api/items/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2 flex-shrink-0">
      <Button disabled={busy} onClick={() => decide('approved')} className="bg-green-600 hover:bg-green-700">
        ✓ 批准
      </Button>
      <Button variant="destructive" disabled={busy} onClick={() => decide('rejected')}>
        ✗ 拒绝
      </Button>
    </div>
  )
}
