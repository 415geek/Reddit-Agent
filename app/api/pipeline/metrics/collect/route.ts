import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from '@/lib/providers/telegram'

/**
 * 数据采集调度:找出发布满 24h/72h/168h 但还没有对应快照的内容。
 * Phase 1(手工模式):发 Telegram 提醒人工录入;Phase 3 接抖音数据接口后自动抓取。
 */
export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied

  const checkpoints = [24, 72, 168]
  const now = Date.now()
  const pubs = await prisma.publication.findMany({ include: { metrics: true, contentItem: true } })

  const due: Array<{ publicationId: string; title: string; atHours: number }> = []
  for (const p of pubs) {
    const ageHours = (now - p.publishedAt.getTime()) / 3600000
    for (const cp of checkpoints) {
      if (ageHours >= cp && !p.metrics.some((m) => m.atHours === cp)) {
        due.push({ publicationId: p.id, title: p.contentItem.title, atHours: cp })
      }
    }
  }

  if (due.length > 0) {
    await sendTelegramMessage(
      `📊 *待录入数据* ${due.length} 项:\n` +
        due.map((d) => `- ${d.title}(${d.atHours}h)`).join('\n') +
        `\n\n请到看板录入:${process.env.FACTORY_APP_URL || ''}/dashboard/published`
    )
  }
  return NextResponse.json({ ok: true, due })
}
