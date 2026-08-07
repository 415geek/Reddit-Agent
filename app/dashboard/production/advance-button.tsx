'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * 推进按钮。
 *
 * 为什么要自己循环:图片资产阶段一次 advance 只干够 40 秒的活(serverless 有函数上限),
 * 十几张图加三段图生视频要十几轮才做得完,而且图生视频是"提交—轮询"两段式,
 * 中间好几轮是纯等待、什么都不产出。以前一次点击只发一个请求,回来卡片长得一模一样,
 * 看上去就是点了没反应——实际后台一直在推进。
 *
 * 现在点一次就把这一阶段跑到底,并把每轮的进度显示出来。
 */

/** 单次点击最多跑多少轮。够 12 图 + 3 段视频跑完还有富余,同时兜住死循环 */
const MAX_ROUNDS = 40
/** 纯等待轮之间歇一下,别把轮询打成密集请求 */
const IDLE_WAIT_MS = 6000

interface AdvanceDetail {
  stayInStage?: boolean
  images?: number
  motionClips?: number
  remaining?: number
  madeThisRound?: number
  waitingForTts?: boolean
  submitted?: boolean
  waitingForWorker?: boolean
  revisedTo?: number
}

function describe(stage: string, d: AdvanceDetail): string {
  if (d.waitingForWorker) return '等合成 worker 领任务'
  if (d.submitted) return '配音已提交,等生成'
  if (d.waitingForTts) return '配音生成中'
  if (d.revisedTo) return `质检未过,已重写第 ${d.revisedTo} 版`
  if (d.images != null) {
    const parts = [`图 ${d.images}`]
    if (d.motionClips != null) parts.push(`动态 ${d.motionClips}`)
    if (d.remaining) parts.push(`还差 ${d.remaining}`)
    return parts.join(' · ')
  }
  return stage
}

export function AdvanceButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const stop = useRef(false)

  useEffect(() => () => {
    stop.current = true
  }, [])

  async function run() {
    setBusy(true)
    setError('')
    stop.current = false
    let rounds = 0

    try {
      while (rounds < MAX_ROUNDS && !stop.current) {
        rounds++
        const res = await fetch(`/api/items/${id}/advance`, { method: 'POST' })
        const json = await res.json()

        if (!json.ok) {
          setError(json.error || '失败')
          break
        }

        const detail = (json.detail ?? {}) as AdvanceDetail
        setStatus(`第${rounds}轮 · ${describe(json.stage, detail)}`)

        // 阶段推完了(到审批或换了阶段且不再原地等待)
        if (json.done) {
          setStatus('已到待审批')
          break
        }
        if (!detail.stayInStage) {
          setStatus(`进入「${json.stage}」`)
          break
        }

        // 这一轮什么都没产出 = 在等外部任务(图生视频/配音),慢一点再问
        if (!detail.madeThisRound) await new Promise((r) => setTimeout(r, IDLE_WAIT_MS))
      }
      if (rounds >= MAX_ROUNDS) setStatus(`已跑 ${MAX_ROUNDS} 轮仍未完成,再点一次继续`)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  return (
    <div>
      <Button size="sm" variant="outline" disabled={busy} onClick={run} className="w-full">
        {busy ? '推进中…' : '推进下一阶段 ▶'}
      </Button>
      {busy && (
        <button onClick={() => (stop.current = true)} className="mt-1 w-full text-xs text-gray-400 underline">
          停止
        </button>
      )}
      {status && !error && <p className="text-xs text-gray-500 mt-1">{status}</p>}
      {error && <p className="text-xs text-red-500 mt-1 line-clamp-3">{error}</p>}
    </div>
  )
}
