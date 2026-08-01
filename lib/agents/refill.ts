import { prisma } from '../prisma'
import { generateJSONWithSearch } from '../ai'
import { REFILL_SYSTEM, refillUser } from '../prompts/note'
import { fetchArticleText, fingerprintUrl } from '../sources/fetch'
import { NOTE_CATEGORIES, TOPIC_GATE } from '../domain'
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
  scores?: { total?: number } & Record<string, number | undefined>
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
      if (p.scores?.total != null && p.scores.total < TOPIC_GATE) {
        skipped.push(`${p.title_top}:${p.scores.total} 分低于门槛`)
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

      // 入池前先抓来源正文。搜索时模型读到的数字,核查阶段要在正文里重新找到
      // 才算数——三条补题选题连续死在这一点上:来源是报告的下载落地页,
      // 数字在 PDF 里、页面上没有,核查把全部关键数字判 unverified,必死。
      // 抓不到正文的选题不进池:反正过不了核查,早拦省下后面三站的钱
      const fullText = sourceItem?.rawText ?? (await fetchArticleText(p.source_url))
      if (!fullText) {
        skipped.push(`${p.title_top}:来源页抓不到正文(下载门/落地页/纯JS),核查必死,不入池`)
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
            rawText: fullText,
            status: 'shortlisted',
          },
        })
      } else if (!sourceItem.rawText) {
        await prisma.sourceItem.update({ where: { id: sourceItem.id }, data: { rawText: fullText } })
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
          scoreTotal: p.scores?.total ?? 75,
          scores: (p.scores ?? undefined) as object | undefined,
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
