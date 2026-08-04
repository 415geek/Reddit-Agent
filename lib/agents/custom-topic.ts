import { prisma } from '../prisma'
import { generateJSONWithSearch } from '../ai'
import { CUSTOM_TOPIC_SYSTEM, customTopicUser } from '../prompts/note'
import { fetchArticleText, fingerprintUrl } from '../sources/fetch'
import { NOTE_CATEGORIES } from '../domain'
import { logEvent } from './events'

/**
 * 自定义题材:老板用一段话描述想发什么,AI 深度检索找到一二档来源、
 * 抓到正文后直接建选题并入队,走和普通选题一模一样的生产链
 * (核实 → 写稿 → 反方审稿 → 合规 → 出图),可溯源标准一分不降。
 *
 * 和补题的区别只有两点:题材是命题(不设 75 分淘汰线,分数照打作参考),
 * 以及产出即入队(老板描述完就是想要这一篇,不用再回池子点一次)。
 * 铁律不变:抓不到来源正文的不做——命题作文也不许编数字。
 */

interface CustomPick {
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

export async function customTopic(description: string) {
  await logEvent({ stage: 'note_custom', status: 'started', detail: { description: description.slice(0, 200) } })
  try {
    const recent = await prisma.topic.findMany({
      where: { source: { in: ['source_item', 'web_search'] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { title: true },
    })

    const raw = await generateJSONWithSearch<CustomPick[] | { topics?: CustomPick[] }>({
      system: CUSTOM_TOPIC_SYSTEM,
      user: customTopicUser(description, recent.map((t) => t.title)),
      maxTokens: 8192,
      // 5 次是实测出的上限:8 次检索 + 抓正文曾经顶穿 Vercel 60 秒函数上限,
      // 函数被杀时连失败事件都来不及写,前端只能干转圈。深度让给写稿链,
      // 建题这步先保证能在预算内活着回来
      maxSearches: 5,
      mockKey: 'note.custom',
    })
    const picks: CustomPick[] = Array.isArray(raw) ? raw : Array.isArray(raw?.topics) ? raw.topics : []

    if (!picks.length) {
      const msg = '这个题材搜不到一二档来源的可核实数据,没法保证真实性。换个说法或缩小范围再试。'
      await logEvent({ stage: 'note_custom', status: 'succeeded', detail: { created: 0, reason: msg } })
      return { ok: false as const, error: msg }
    }

    // 候选按扎实程度排序,逐个试抓正文,第一个抓到的就用——
    // 抓不到正文的候选和补题同罪:核查必死,不做。
    // 只试前两个、每个限时 12 秒:检索已经花掉大半预算,抓正文这步
    // 再慢也不能把整个函数拖死(超时被杀 = 用户面前永远转圈)
    const skipped: string[] = []
    const fetchWithDeadline = (url: string) =>
      Promise.race([
        fetchArticleText(url),
        new Promise<null>((r) => setTimeout(() => r(null), 12_000)),
      ])
    for (const p of picks.slice(0, 2)) {
      if (!p.title_top || !p.title_bottom || !p.source_url) {
        skipped.push('候选缺字段')
        continue
      }
      const fingerprint = fingerprintUrl(p.source_url)
      let sourceItem = await prisma.sourceItem.findUnique({ where: { fingerprint } })
      if (sourceItem?.status === 'used') {
        skipped.push(`${p.source_name}:这篇来源已经成过稿`)
        continue
      }
      const fullText = sourceItem?.rawText ?? (await fetchWithDeadline(p.source_url))
      if (!fullText) {
        skipped.push(`${p.source_name}:来源页抓不到正文`)
        continue
      }

      const summary = [p.angle, ...(p.facts ?? [])].filter(Boolean).join('\n')
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

      const topic = await prisma.topic.create({
        data: {
          title: `${p.title_top} / ${p.title_bottom}`,
          hook: p.angle,
          category: (NOTE_CATEGORIES as readonly string[]).includes(p.category) ? p.category : 'ops',
          region: 'north_america',
          source: 'web_search',
          sourceItemId: sourceItem.id,
          status: 'in_production',
          scoreTotal: p.scores?.total ?? null,
          scores: (p.scores ?? undefined) as object | undefined,
          notes: JSON.stringify({
            titleTop: p.title_top,
            titleBottom: p.title_bottom,
            noteTitle: p.note_title,
            angle: p.angle,
            whyNow: p.why_now,
            // 老板的原话跟着选题走,审稿理由和回溯时都用得上
            userBrief: description.slice(0, 500),
          }),
        },
      })
      const item = await prisma.contentItem.create({
        data: { topicId: topic.id, title: topic.title, kind: 'note', stage: 'research' },
      })

      const result = { ok: true as const, itemId: item.id, topicId: topic.id, title: topic.title, skipped }
      await logEvent({ stage: 'note_custom', status: 'succeeded', detail: result })
      return result
    }

    const msg = `搜到了候选但都不可用:${skipped.join(';').slice(0, 200) || '来源都抓不到正文'}。换个说法再试。`
    await logEvent({ stage: 'note_custom', status: 'succeeded', detail: { created: 0, skipped } })
    return { ok: false as const, error: msg }
  } catch (e) {
    await logEvent({ stage: 'note_custom', status: 'failed', error: String(e) })
    throw e
  }
}
