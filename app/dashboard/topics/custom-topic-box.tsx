'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * 自定义题材:老板用一段话描述想发什么,提交后 AI 深度检索找来源、建题、
 * 直接入队,然后由这里的循环把整条生产链推到底——和「入队」按钮的体验一致:
 * 描述完等几分钟,直接去已完成页复制发布。
 *
 * 状态提示必须一直活着:检索一分钟 + 生产四五分钟,中间任何一段"没动静"
 * 都会让人以为死机了。
 */

const MAX_ROUNDS = 30

interface AdvanceOut {
  ok: boolean
  stage?: string
  done?: boolean
  skipped?: boolean
  error?: string
  detail?: { rewrittenTo?: number; version?: number; done?: number; total?: number; reason?: string }
}

function describe(out: AdvanceOut): string {
  const d = out.detail ?? {}
  if (d.total != null) return `出图渲卡 ${d.done ?? 0}/${d.total}`
  if (out.stage === 'research') return '深挖来源正文中'
  if (out.stage === 'verify') return '逐条核查证据中'
  if (out.stage === 'note') return d.version ? `重写第 ${d.version} 版` : '证据过关,写稿中'
  if (out.stage === 'critic') return '反方审稿中'
  if (out.stage === 'qc') return '合规终审中'
  if (out.stage === 'cards') return '过审,出图中'
  return '推进中'
}

export function CustomTopicBox() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [doneTitle, setDoneTitle] = useState('')
  const [error, setError] = useState('')
  const stop = useRef(false)

  async function run() {
    const description = text.trim()
    if (description.length < 5) {
      setError('先把想发的题材写成一句完整的话')
      return
    }
    setBusy(true)
    setError('')
    setDoneTitle('')
    setProgress('AI 正在理解题材并深度检索来源,约 1 分钟…')
    try {
      const res = await fetch('/api/topics/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const json = (await res.json()) as { ok: boolean; itemId?: string; title?: string; error?: string }
      if (!json.ok || !json.itemId) {
        setError(json.error ?? '出错了,再试一次')
        setProgress('')
        return
      }
      setProgress(`已建题「${json.title}」,开始生产…`)
      router.refresh()

      for (let i = 0; i < MAX_ROUNDS && !stop.current; i++) {
        let out: AdvanceOut
        try {
          const r = await fetch(`/api/items/${json.itemId}/advance`, { method: 'POST' })
          out = (await r.json()) as AdvanceOut
        } catch {
          await new Promise((r) => setTimeout(r, 4000))
          continue
        }
        if (!out.ok) {
          setError(`出错了:${(out.error ?? '').slice(0, 120)}(cron 稍后会自动接力)`)
          setProgress('')
          return
        }
        if (out.skipped) {
          await new Promise((r) => setTimeout(r, 10_000))
          continue
        }
        if (out.stage === 'rejected') {
          setError('这篇多轮重写后仍没过反方审稿,已停产。理由在「已完成」页底部可查。')
          setProgress('')
          return
        }
        setProgress(describe(out))
        if (out.stage === 'awaiting_approval' || out.done) {
          setDoneTitle(json.title ?? '已生成')
          setProgress('')
          setText('')
          router.refresh()
          return
        }
      }
      setProgress('')
      setError('这条还在后台生产(cron 每小时接力),稍后去已完成页看')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 space-y-2">
      <p className="text-sm font-medium text-gray-800">自定义题材描述</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={3}
        maxLength={1000}
        placeholder="用你自己的话描述想发的题材,比如:最近很多老板在问外卖平台的照片拍摄服务值不值得买,帮我查查有没有数据说明照片质量对下单率的影响"
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 text-xs">
          {progress && (
            <span className="flex items-center gap-2 text-orange-600">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              {progress}
            </span>
          )}
          {error && <span className="text-red-500">{error}</span>}
          {doneTitle && (
            <span className="text-green-600">
              ✓「{doneTitle}」已生成,
              <Link href="/dashboard/approvals" className="underline font-medium">
                去复制发布
              </Link>
            </span>
          )}
        </div>
        <button
          onClick={run}
          disabled={busy || text.trim().length < 5}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white active:scale-95 transition disabled:opacity-50"
        >
          {busy ? '生成中…' : '深研并生成'}
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        AI 会深度检索权威来源、逐条核实数据后按原有标准编稿;搜不到可核实来源的题材会如实告知,不会编数据。
      </p>
    </div>
  )
}
