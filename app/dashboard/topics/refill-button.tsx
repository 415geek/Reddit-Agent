'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 补题按钮:AI 带着联网搜索出去扫一圈(政策/运营/营销心理/商业理论/趋势),
 * 搜到的直接变成带来源的选题落进池子,和每日采集的选题长得一模一样,照样入队。
 *
 * 一轮 30-60 秒——真的在搜网页。按钮按下去必须一直有活着的状态提示,
 * 否则这一分钟像死机。
 */
export function RefillButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function run() {
    setBusy(true)
    setNote('全网搜索中,约 1 分钟…')
    try {
      const res = await fetch('/api/topics/refill', { method: 'POST' })
      const json = (await res.json()) as { ok: boolean; created?: number; error?: string }
      if (!json.ok) {
        setNote(`失败:${(json.error ?? '').slice(0, 80)}`)
        return
      }
      setNote(json.created ? `✓ 补了 ${json.created} 条新选题` : '这一轮没搜到值得做的,晚点再试')
      router.refresh()
      setTimeout(() => setNote(''), 5000)
    } catch {
      // 连接断了不代表白跑:服务端常常已经把题补进库了(实测:65 秒完成,
      // 手机端 60 秒断开)。刷新一下把可能已入库的新题带出来,话也说实在点
      router.refresh()
      setNote('连接超时断开,但搜索可能已在后台完成——看看上面有没有新题,没有再点一次')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {note && <span className="text-xs text-gray-500">{note}</span>}
      <button
        onClick={run}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white active:scale-95 transition disabled:opacity-60"
      >
        {busy ? (
          <>
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            搜索中…
          </>
        ) : (
          '⊕ 题材更新'
        )}
      </button>
    </div>
  )
}
