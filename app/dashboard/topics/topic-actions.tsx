'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TopicActions({ id, status, className }: { id: string; status: string; className?: string }) {
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

  // 按钮靠右、自适应宽度。撑满整行看着是够大,但 137 条选题每条顶两条蓝色横杠,
  // 一屏只剩三条能看,翻起来太慢——高度保住 40px 就够拇指点了。
  return (
    <div className={cn('flex gap-2 sm:gap-1.5 justify-end', className)}>
      {(status === 'idea' || status === 'scored') && (
        <>
          <Button size="sm" disabled={busy} onClick={() => setStatus('queued')} className="min-w-[76px]">
            入队
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setStatus('rejected')}
            className="min-w-[76px]"
          >
            淘汰
          </Button>
        </>
      )}
      {(status === 'rejected' || status === 'retired') && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setStatus('idea')}
          className="min-w-[76px]"
        >
          恢复
        </Button>
      )}
    </div>
  )
}
