'use client'

import { useState } from 'react'

/**
 * 图文的审批预览:整组卡片横滑 + 发布文案一键复制。
 *
 * 小红书没有开放发布 API,最后一步永远是人拿手机发。
 * 所以这一页的目标是把"发"变成三个动作:存图、粘贴文案、点发布——
 * 复制按钮把 标题/正文/话题 一次拼好,不用在手机上来回选字。
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

  return (
    <div className="space-y-4">
      {/* 卡片横滑。手机上一屏一张半,能预感到还有下一张 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {cards.map((c) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={c.idx}
            src={c.url}
            alt={`第${c.idx + 1}张`}
            className="h-64 sm:h-80 w-auto rounded-lg border border-gray-200 shrink-0 snap-start"
            loading="lazy"
          />
        ))}
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
        <p className="text-sm font-semibold text-gray-900">{noteTitle}</p>
        <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{bodyText}</p>
        <p className="text-[13px] text-blue-600">{tags}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => copy('full', full)}
          className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium active:scale-95 transition"
        >
          {copied === 'full' ? '已复制 ✓' : '复制全部文案'}
        </button>
        <button
          onClick={() => copy('title', noteTitle)}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm active:scale-95 transition"
        >
          {copied === 'title' ? '已复制 ✓' : '只复制标题'}
        </button>
        <button
          onClick={() => copy('body', `${bodyText}\n\n${tags}`)}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm active:scale-95 transition"
        >
          {copied === 'body' ? '已复制 ✓' : '只复制正文+话题'}
        </button>
        <a
          href={`/api/items/${itemId}/cards.zip`}
          className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm active:scale-95 transition"
        >
          打包下载({cards.length}张图+文案)
        </a>
      </div>
    </div>
  )
}
