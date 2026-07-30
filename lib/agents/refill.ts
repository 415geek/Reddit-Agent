import { prisma } from '../prisma'
import { generateJSONWithSearch } from '../ai'
import { REFILL_SYSTEM, refillUser } from '../prompts/note'
import { fingerprintUrl } from '../sources/fetch'
import { NOTE_CATEGORIES } from '../domain'
import { logEvent } from './events'

/**
 * 补题:模型带着联网搜索出去扫一圈(政策/运营/营销心理/商业理论/趋势),
 * 搜到的直接整理成选题落进池子。
 *
 * 和每日采集是互补而不是替代:白名单采集稳定、便宜、来源可控,是主粮;
 * 补题是老板觉得"今天池子里没有想发的"时,主动出去找增量。
 * 搜到的东西同样落成 SourceItem(带 URL 和事实摘要),
 * 下游的核实/写稿不知道也不需要知道素材是搜来的还是采来的。
 */

interface RefillPick {
  title_top: string
  title_bottom: string
  note_title: string
  angle: string
  category: string
  why_now?: string
  source_name: string
  source_url: string
  published_at?: string
  facts?: string[]
}

export async function refillTopics(count = 4) {
  await logEvent({ stage: 'note_refill', status: 'started', detail: { count } })
  try {
    const recent = await prisma.topic.findMany({
      where: { source: { in: ['source_item', 'web_search'] } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { title: true },
    })

    const raw = await generateJSONWithSearch<RefillPick[] | { topics?: RefillPick[] }>({
      system: REFILL_SYSTEM,
      user: refillUser(count, recent.map((t) => t.title)),
      maxTokens: 8192,
      maxSearches: 6,
      mockKey: 'note.refill',
    })
    const picks: RefillPick[] = Array.isArray(raw) ? raw : Array.isArray(raw?.topics) ? raw.topics : []

    let created = 0
    const skipped: string[] = []
    for (const p of picks) {
      if (!p.title_top || !p.title_bottom || !p.source_url) {
        skipped.push(`缺字段:${(p.note_title ?? '').slice(0, 30)}`)
        continue
      }
      // 摘要 = 角度 + 挖到的事实。下游核实吃的就是这段,事实必须落进去
      const summary = [p.angle, ...(p.facts ?? [])].filter(Boolean).join('\n')
      const fingerprint = fingerprintUrl(p.source_url)

      let sourceItem = await prisma.sourceItem.findUnique({ where: { fingerprint } })
      if (sourceItem?.status === 'used') {
        skipped.push(`已成过稿:${p.source_name}`)
        continue
      }
      if (!sourceItem) {
        sourceItem = await prisma.sourceItem.create({
          data: {
            fingerprint,
            url: p.source_url,
            title: p.note_title,
            source: p.source_name,
            category: p.category === 'policy' ? 'policy' : 'trend',
            publishedAt: p.published_at ? new Date(p.published_at) : null,
            summary,
            status: 'shortlisted',
          },
        })
      }

      await prisma.topic.create({
        data: {
          title: `${p.title_top} / ${p.title_bottom}`,
          hook: p.angle,
          category: (NOTE_CATEGORIES as readonly string[]).includes(p.category) ? p.category : 'ops',
          region: 'north_america',
          source: 'web_search',
          sourceItemId: sourceItem.id,
          status: 'scored',
          // 搜来的没有源权重,给个中上的固定分:模型已经按两道杠筛过一轮
          scoreTotal: 75,
          notes: JSON.stringify({
            titleTop: p.title_top,
            titleBottom: p.title_bottom,
            noteTitle: p.note_title,
            angle: p.angle,
            whyNow: p.why_now,
          }),
        },
      })
      created++
    }

    const result = { returned: picks.length, created, skipped }
    await logEvent({ stage: 'note_refill', status: 'succeeded', detail: result })
    return result
  } catch (e) {
    await logEvent({ stage: 'note_refill', status: 'failed', error: String(e) })
    throw e
  }
}
