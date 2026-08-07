'use client'

import { useState } from 'react'

/**
 * 图文的审批预览:卡片点开放大逐张保存 + 发布文案一键复制。
 *
 * 小红书没有开放发布 API,最后一步永远是人拿手机发。
 * 所以这一页照着"手机发布"这个动作设计:
 *   点一张卡 → 全屏放大 → 长按存入相册(iOS/安卓的原生动作,存的就是原图)
 *   → 存完点右上角下一张,顺序过完六张 → 回来点「复制全部文案」→ 去小红书粘贴。
 *
 * 之前只有 zip 打包,但 zip 在 iPhone 上落进"文件"App,还得手动挪去相册,
 * 反而多两步——打包降级成角落里的小链接,给电脑用。
 */

export function NotePreview({
  itemId,
  cards,
  noteTitle,
  bodyText,
  hashtags,
}: {
  itemId: string
  cards: Array<{ idx: number; url: string }>
  noteTitle: string
  bodyText: string
  hashtags: string[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  /** 当前放大的卡片下标(cards 数组下标,不是 idx),null = 没放大 */
  const [viewing, setViewing] = useState<number | null>(null)

  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      // http 或旧浏览器拿不到 clipboard 权限时退回选中文本,至少能手动复制
      window.prompt('手动复制:', text)
    }
  }

  const tags = hashtags.map((h) => `#${h}`).join(' ')
  const full = `${noteTitle}\n\n${bodyText}\n\n${tags}`
  const current = viewing != null ? cards[viewing] : null

  return (
    <div className="space-y-4">
      {/* 卡片横滑,点一张放大 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {cards.map((c, i) => (
          <button key={c.idx} onClick={() => setViewing(i)} className="relative shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.url}
              alt={`第${c.idx + 1}张`}
              className="h-64 sm:h-80 w-auto rounded-lg border border-gray-200"
              loading="lazy"
            />
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
              {c.idx + 1}/{cards.length} · 点开保存
            </span>
          </button>
        ))}
      </div>

      {/* 全屏查看:长按存相册 */}
      {current && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setViewing(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm">
              第 {current.idx + 1} / {cards.length} 张 · <span className="text-orange-300">长按图片存入相册</span>
            </span>
            <div className="flex items-center gap-3">
              {viewing! > 0 && (
                <button onClick={() => setViewing(viewing! - 1)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">
                  上一张
                </button>
              )}
              {viewing! < cards.length - 1 && (
                <button onClick={() => setViewing(viewing! + 1)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">
                  下一张
                </button>
              )}
              <button onClick={() => setViewing(null)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">
                关闭 ✕
              </button>
            </div>
          </div>
          {/* 图本体不关闭浮层:长按弹出的是系统菜单,误触外面才关 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`第${current.idx + 1}张`}
            className="flex-1 min-h-0 w-full object-contain px-2 pb-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
        <p className="text-sm font-semibold text-gray-900">{noteTitle}</p>
        <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{bodyText}</p>
        <p className="text-[13px] text-blue-600">{tags}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => copy('title', noteTitle)}
          className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium active:scale-95 transition"
        >
          {copied === 'title' ? '已复制 ✓' : '① 复制标题'}
        </button>
        <button
          onClick={() => copy('body', `${bodyText}\n\n${tags}`)}
          className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium active:scale-95 transition"
        >
          {copied === 'body' ? '已复制 ✓' : '② 复制正文+话题'}
        </button>
        <button
          onClick={() => copy('full', full)}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm active:scale-95 transition"
        >
          {copied === 'full' ? '已复制 ✓' : '合并复制'}
        </button>
        <a href={`/api/items/${itemId}/cards.zip`} className="text-xs text-gray-400 underline ml-auto">
          电脑打包下载
        </a>
      </div>
    </div>
  )
}
