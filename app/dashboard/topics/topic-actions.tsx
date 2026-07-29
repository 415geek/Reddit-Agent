'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 选题卡上的操作。图文选题点「入队」之后,浏览器直接把整条流水线推到底:
 * 核实 → 写稿 → 质检 → 出图渲卡,进度就显示在这张卡上,
 * 推完给一个「去审批页」的链接——老板的动线是 选题 → (等几分钟) → 复制发布。
 *
 * 为什么在浏览器里循环:serverless 一次函数调用推不完整条(写稿+质检 ~2 分钟、
 * 出图渲卡又 ~2 分钟),必须有人反复敲 advance。每小时的 cron 也会敲,
 * 但那意味着入队后干等最多一小时。浏览器开着就由浏览器敲;中途关页面也没事,
 * cron 会把剩下的接着跑完。
 */

const MAX_ROUNDS = 30

interface AdvanceOut {
  ok: boolean
  stage?: string
  done?: boolean
  error?: string
  detail?: {
    stayInStage?: boolean
    facts?: number
    version?: number
    cards?: number
    passed?: boolean
    rewrittenTo?: number
    madeImages?: number
    madeCards?: number
    done?: number
    total?: number
    remaining?: number
  }
}

function describe(out: AdvanceOut): string {
  const d = out.detail ?? {}
  if (out.stage === 'awaiting_approval') return '完成'
  if (d.rewrittenTo) return `质检打回,重写第 ${d.rewrittenTo} 版`
  if (d.total != null) return `出图渲卡 ${d.done ?? 0}/${d.total}`
  if (out.stage === 'note') return '核实完成,写稿中'
  if (out.stage === 'qc') return '稿子写完,质检中'
  if (out.stage === 'cards') return '质检通过,出图中'
  return out.stage ?? '推进中'
}

export function TopicActions({ id, status, className }: { id: string; status: string; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [doneItemId, setDoneItemId] = useState('')
  const [error, setError] = useState('')
  const stop = useRef(false)

  useEffect(() => () => { stop.current = true }, [])

  async function setStatus(next: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = (await res.json()) as { itemId?: string; kind?: string; error?: string }
      if (!res.ok) {
        setError(json.error ?? '操作失败')
        router.refresh()
        return
      }

      // 图文入队 → 当场推到底。视频选题不自动推(那条线停用)
      if (next === 'queued' && json.itemId && json.kind === 'note') {
        setProgress('已入队,开始生成…')
        for (let i = 0; i < MAX_ROUNDS && !stop.current; i++) {
          const r = await fetch(`/api/items/${json.itemId}/advance`, { method: 'POST' })
          const out = (await r.json()) as AdvanceOut
          if (!out.ok) {
            setError(`出错了:${(out.error ?? '').slice(0, 120)}(cron 稍后会自动重试)`)
            break
          }
          setProgress(describe(out))
          if (out.stage === 'awaiting_approval' || out.done) {
            setDoneItemId(json.itemId)
            setProgress('')
            break
          }
        }
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (doneItemId) {
    return (
      <div className={cn('flex justify-end', className)}>
        <Link
          href="/dashboard/approvals"
          className="text-sm font-medium text-white bg-green-600 rounded-lg px-3 py-2 active:scale-95 transition"
        >
          ✓ 已生成,去复制发布
        </Link>
      </div>
    )
  }

  if (busy && progress) {
    return (
      <div className={cn('flex items-center justify-end gap-2 text-sm text-orange-600', className)}>
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        {progress}
      </div>
    )
  }

  if (status === 'in_production' || status === 'published') return null

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      {error && <p className="text-xs text-red-500 text-right">{error}</p>}
      <div className="flex gap-2 sm:gap-1.5 justify-end">
        {(status === 'idea' || status === 'scored') && (
          <>
            <Button size="sm" disabled={busy} onClick={() => setStatus('queued')} className="min-w-[76px]">
              {busy ? '…' : '入队'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('rejected')} className="min-w-[76px]">
              淘汰
            </Button>
          </>
        )}
        {(status === 'rejected' || status === 'retired') && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('idea')} className="min-w-[76px]">
            恢复
          </Button>
        )}
      </div>
    </div>
  )
}
