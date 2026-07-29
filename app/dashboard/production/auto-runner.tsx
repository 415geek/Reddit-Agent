'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 图文条目的自动推进器:挂在生产页的卡片上,页面一打开就自己跑,
 * 没有任何按钮——推进这件事从头到尾不需要人。
 *
 * 为什么放在浏览器里跑:serverless 一次调用推不完整条,得有人反复敲 advance。
 * 入队那一刻是选题页在敲;如果老板中途关了页面,这里就是第二道保险——
 * 只要他打开生产页看一眼,推进就继续。两边都没开也没关系,每小时的 cron 兜底。
 *
 * 防重:同一个条目在同一个页面里只跑一个循环(React 严格模式会挂载两次,
 * 不防的话每一步模型调用都会翻倍烧钱)。跨标签页的重复无法完全避免,
 * 但阶段机是可续跑的,重复推只是偶尔多花一次调用,不会把数据推乱。
 */

const running = new Set<string>()
const MAX_ROUNDS = 30

interface AdvanceOut {
  ok: boolean
  stage?: string
  done?: boolean
  error?: string
  detail?: { rewrittenTo?: number; done?: number; total?: number }
}

function describe(out: AdvanceOut): string {
  const d = out.detail ?? {}
  if (d.rewrittenTo) return `质检打回,重写第 ${d.rewrittenTo} 版`
  if (d.total != null) return `出图渲卡 ${d.done ?? 0}/${d.total}`
  if (out.stage === 'note') return '核实完成,写稿中'
  if (out.stage === 'qc') return '稿子写完,质检中'
  if (out.stage === 'cards') return '质检通过,出图中'
  return '推进中'
}

export function AutoRunner({ id, stage }: { id: string; stage: string }) {
  const router = useRouter()
  const [progress, setProgress] = useState(() => {
    if (stage === 'research') return '核实素材中'
    if (stage === 'note') return '写稿中'
    if (stage === 'qc') return '质检中'
    if (stage === 'cards') return '出图渲卡中'
    return '推进中'
  })
  const [error, setError] = useState('')
  const stopped = useRef(false)

  useEffect(() => {
    if (running.has(id)) return
    running.add(id)
    stopped.current = false

    ;(async () => {
      for (let i = 0; i < MAX_ROUNDS && !stopped.current; i++) {
        let out: AdvanceOut
        try {
          const r = await fetch(`/api/items/${id}/advance`, { method: 'POST' })
          out = (await r.json()) as AdvanceOut
        } catch {
          // 单次网络抖动不值得停:歇口气接着推
          await new Promise((r) => setTimeout(r, 4000))
          continue
        }
        if (!out.ok) {
          setError(`${(out.error ?? '').slice(0, 110)}(cron 会自动重试)`)
          break
        }
        setProgress(describe(out))
        if (out.stage === 'awaiting_approval' || out.done) {
          router.refresh()
          break
        }
      }
      running.delete(id)
    })()

    return () => {
      stopped.current = true
      running.delete(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return <p className="text-xs text-red-500">{error}</p>
  return (
    <p className="flex items-center gap-2 text-xs text-orange-600">
      <span className="inline-block h-3 w-3 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      {progress}
    </p>
  )
}
