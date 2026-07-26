export const dynamic = 'force-dynamic'

import type { Viewport } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { CoverCanvas } from './cover-canvas'

/**
 * 封面渲染页:1080×1920,AI只生成背景,标题由本页程序化叠加(字体/阴影/间距完全一致)。
 * 访问:登录 cookie,或 ?token=<N8N_WEBHOOK_SECRET>(供 Playwright 截图)。
 * ?scale=fit 时按视口缩放(用于看板 iframe 预览)。
 */

/**
 * 这一页必须自己声明 viewport。它被审批页用 iframe 嵌着,而移动浏览器对
 * 没有 viewport meta 的 iframe 会套用 980px 的默认布局视口——
 * scale(100vw/1080) 里的 100vw 就变成 980 而不是 iframe 的真实宽度,
 * 封面被放大到近乎原尺寸,只能看见左上角一块。
 */
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }
export default async function CoverPage({
  params,
  searchParams,
}: {
  params: { itemId: string }
  searchParams: { token?: string; scale?: string }
}) {
  const viaToken = Boolean(
    searchParams.token && process.env.N8N_WEBHOOK_SECRET && searchParams.token === process.env.N8N_WEBHOOK_SECRET
  )
  const session = viaToken ? null : await getSession()
  if (!viaToken && !session) {
    return <div style={{ color: '#fff', background: '#000', padding: 40 }}>Unauthorized</div>
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: params.itemId },
    include: { assets: { where: { kind: 'cover_bg' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!item) return <div style={{ color: '#fff', background: '#000', padding: 40 }}>Not found</div>

  const bg = item.assets[0]
  const bgUrl = bg
    ? `/api/assets/${bg.path}${searchParams.token ? `?token=${searchParams.token}` : ''}`
    : null

  const lines = item.coverTitleLines.length > 0 ? item.coverTitleLines.slice(0, 3) : [item.title.slice(0, 7)]

  return (
    <CoverCanvas
      template={item.coverTemplate}
      lines={lines}
      bgUrl={bgUrl}
      fit={searchParams.scale === 'fit'}
    />
  )
}
