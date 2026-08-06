import { prisma } from '../prisma'
import { generateJSONWithSearch, SearchOutputNotJson } from '../ai'
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

export interface CustomTopicOpts {
  /** 老板看过 AI 编辑的顾虑后点了「确定生成」 */
  confirmed?: boolean
  /** 老板声明与相关品牌有合作关系,内容按显著披露的合作内容来写 */
  sponsored?: boolean
}

export async function customTopic(description: string, opts: CustomTopicOpts = {}) {
  await logEvent({
    stage: 'note_custom',
    status: 'started',
    detail: { description: description.slice(0, 200), confirmed: !!opts.confirmed, sponsored: !!opts.sponsored },
  })
  try {
    const recent = await prisma.topic.findMany({
      where: { source: { in: ['source_item', 'web_search'] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { title: true },
    })

    let user = customTopicUser(description, recent.map((t) => t.title))
    if (opts.confirmed) {
      // 确认续跑:顾虑老板已经看过,这一轮必须给出 topics,倾向按合规路径落地。
      // 暗推在确认后也不解锁——确认解锁的是"继续做这个题材",不是"跳过披露"
      user += `\n\n老板已看过你的顾虑并确认继续生成。这次不要再输出 concern,直接输出 topics。
倾向处理方式:${
        opts.sponsored
          ? '老板已声明与相关品牌有合作关系。按「合作内容」来写:angle 里必须带「合作内容,文中需显著披露合作关系」,倾向可以明说,事实照样全部可溯源。'
          : '老板未声明合作关系。写成客观横向对比:相关品牌凭一二档来源里的事实入场,结论跟着事实走;来源撑不起的倾向不写。'
      }`
    }

    let raw: CustomPick[] | { topics?: CustomPick[]; concern?: string }
    try {
      raw = await generateJSONWithSearch<CustomPick[] | { topics?: CustomPick[]; concern?: string }>({
        system: CUSTOM_TOPIC_SYSTEM,
        user,
        maxTokens: 8192,
        // 5 次是实测出的上限:8 次检索 + 抓正文曾经顶穿 Vercel 60 秒函数上限,
        // 函数被杀时连失败事件都来不及写,前端只能干转圈。深度让给写稿链,
        // 建题这步先保证能在预算内活着回来
        maxSearches: 5,
        mockKey: 'note.custom',
      })
    } catch (e) {
      // 模型放着 JSON 不写、用大白话讲顾虑的情况(实测发生过):
      // 那段话就是给老板看的,原样端出去 + 确认按钮,别让它淹死在解析报错里
      if (e instanceof SearchOutputNotJson) {
        const concern = e.rawText.trim().slice(0, 600)
        await logEvent({ stage: 'note_custom', status: 'succeeded', detail: { needsConfirm: true, concern: concern.slice(0, 200) } })
        return { ok: false as const, needsConfirm: true as const, concern }
      }
      throw e
    }

    const picks: CustomPick[] = Array.isArray(raw) ? raw : Array.isArray(raw?.topics) ? raw.topics : []
    const concern = !Array.isArray(raw) && typeof raw?.concern === 'string' ? raw.concern.trim() : ''

    // 编辑有顾虑且没给选题:把顾虑端给老板,等他点「确定生成」
    if (concern && !picks.length) {
      await logEvent({ stage: 'note_custom', status: 'succeeded', detail: { needsConfirm: true, concern: concern.slice(0, 200) } })
      return { ok: false as const, needsConfirm: true as const, concern: concern.slice(0, 600) }
    }

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
            // 合作声明跟着 angle 走:写稿和合规终审都吃这一行,双保险——
            // 就算模型没按指令把披露写进 angle,这里也补上
            angle: opts.sponsored && !/合作内容/.test(p.angle)
              ? `${p.angle}(合作内容:文中需显著披露与相关品牌的合作关系)`
              : p.angle,
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
