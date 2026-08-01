'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ApprovalActions({ id, stage }: { id: string; stage?: string }) {
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

  // 已通过的稿子留在页面上供随时复制/存图,不再需要按钮
  if (stage === 'approved') {
    return <span className="text-sm text-green-600 font-medium flex-shrink-0">✓ 已通过</span>
  }

  return (
    // 批准/拒绝是这一页唯一的操作,手机上让它们各占半行、够大够好点
    <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
      <Button
        disabled={busy}
        onClick={() => decide('approved')}
        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 active:bg-green-800"
      >
        ✓ 批准
      </Button>
      <Button variant="destructive" disabled={busy} onClick={() => decide('rejected')} className="flex-1 sm:flex-none">
        ✗ 拒绝
      </Button>
    </div>
  )
}
