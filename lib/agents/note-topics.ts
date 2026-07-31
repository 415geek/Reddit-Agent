import { prisma } from '../prisma'
import { generateJSON } from '../ai'
import { NOTE_TOPIC_SYSTEM, noteTopicUser } from '../prompts/note'
import { logEvent } from './events'
import { TOPIC_GATE } from '../domain'

/**
 * 图文选题:从今天采到的素材里挑,不再凭空生成。
 *
 * 和视频那条线最大的区别就在这儿。视频是先有一个固定选题库、模型自己想标题;
 * 图文是"每天全网搜集 → 从搜到的东西里挑",所以选题必须挂在一条真实素材上。
 * 挂不上素材的选题一律不要——那样又变回凭记忆编数字了,
 * 而这个号最能打的政策法规类恰恰最经不起编。
 */

/** 一次喂给模型多少条素材。太多会稀释注意力,也会把 token 撑爆 */
const CANDIDATE_POOL = Number(process.env.NOTE_TOPIC_POOL || 60)

interface PickedTopic {
  sourceIndex: number
  title_top: string
  title_bottom: string
  note_title: string
  angle: string
  category: string
  why_now?: string
  scores?: { total?: number } & Record<string, number | undefined>
}

export async function pickNoteTopics(count = 5) {
  await logEvent({ stage: 'note_topics', status: 'started', detail: { count } })
  try {
    // 优先给权重高的源和政策法规类。这两个排序合起来的效果是:
    // 联邦公报和劳工部的新规排在行业媒体的开店消息前面
    const pool = await prisma.sourceItem.findMany({
      where: { status: 'new' },
      orderBy: [{ publishedAt: 'desc' }],
      take: CANDIDATE_POOL * 3,
      include: { feed: { select: { weight: true } } },
    })
    if (!pool.length) {
      const result = { picked: 0, reason: '素材池是空的,先跑一次采集' }
      await logEvent({ stage: 'note_topics', status: 'succeeded', detail: result })
      return result
    }

    const CATEGORY_BONUS: Record<string, number> = { regulation: 25, policy: 20, report: 10, data: 10, trend: 5 }
    const ranked = [...pool]
      .sort((a, b) => {
        const sa = (a.feed?.weight ?? 50) + (CATEGORY_BONUS[a.category] ?? 0)
        const sb = (b.feed?.weight ?? 50) + (CATEGORY_BONUS[b.category] ?? 0)
        return sb - sa
      })
      .slice(0, CANDIDATE_POOL)

    const recent = await prisma.topic.findMany({
      where: { source: { in: ['source_item', 'web_search'] } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { title: true },
    })

    const raw = await generateJSON<PickedTopic[] | Record<string, unknown>>({
      system: NOTE_TOPIC_SYSTEM,
      user: noteTopicUser(
        ranked.map((r) => ({
          title: r.title,
          source: r.source,
          summary: r.summary,
          publishedAt: r.publishedAt?.toISOString().slice(0, 10) ?? null,
          category: r.category,
        })),
        count,
        recent.map((t) => t.title),
      ),
      maxTokens: 8192,
      mockKey: 'note.topics',
    })
    // 提示词要求输出数组,但模型偶尔会包一层对象({"topics": [...]})
    // 或者只挑出一条时直接给单个对象。三种形状都接住,别让一次任性把整轮选题炸掉
    const picks: PickedTopic[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.topics)
        ? ((raw as Record<string, unknown>).topics as PickedTopic[])
        : raw && typeof raw === 'object' && 'sourceIndex' in raw
          ? [raw as unknown as PickedTopic]
          : []
    // 空结果时把原始形状记下来。空可能是"模型真觉得没得挑"(合法),
    // 也可能是它换了个没见过的包装被上面判成了空——不留痕迹就分不清这两种
    if (!picks.length) {
      await logEvent({
        stage: 'note_topics',
        status: 'succeeded',
        detail: { emptyPicks: true, rawShape: Array.isArray(raw) ? 'empty_array' : Object.keys(raw ?? {}).slice(0, 8) },
      })
    }

    let saved = 0
    const skipped: string[] = []
    for (const p of picks) {
      const src = ranked[p.sourceIndex]
      // 下标对不上就丢掉。宁可少一条,也不能让选题挂到错误的素材上——
      // 后面写稿会拿这条素材当事实依据,挂错等于凭空捏造
      if (!src || !p.title_top || !p.title_bottom) {
        skipped.push(`下标 ${p.sourceIndex} 对不上素材`)
        continue
      }
      // 门槛在程序侧再守一次:提示词说了"低于 75 不要输出",但门槛必须
      // 长在代码里——提示词是请求,代码才是规则
      if (p.scores?.total != null && p.scores.total < TOPIC_GATE) {
        skipped.push(`${p.title_top}:${p.scores.total} 分低于门槛 ${TOPIC_GATE}`)
        continue
      }
      const title = `${p.title_top} / ${p.title_bottom}`
      await prisma.topic.create({
        data: {
          title,
          hook: p.angle ?? null,
          category: p.category || 'ops',
          region: src.region,
          source: 'source_item',
          sourceItemId: src.id,
          status: 'scored',
          scoreTotal: p.scores?.total ?? (src.feed?.weight ?? 50) + (CATEGORY_BONUS[src.category] ?? 0),
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
      await prisma.sourceItem.update({ where: { id: src.id }, data: { status: 'shortlisted' } })
      saved++
    }

    const result = { pool: ranked.length, returned: picks.length, picked: saved, skipped }
    await logEvent({ stage: 'note_topics', status: 'succeeded', detail: result })
    return result
  } catch (e) {
    await logEvent({ stage: 'note_topics', status: 'failed', error: String(e) })
    throw e
  }
}

/** 把选题排进生产。图文的第一个阶段是 research */
export async function queueNoteTopics(limit = 3) {
  const topics = await prisma.topic.findMany({
    // 补题(web_search)产的选题和采集产的同等待遇,不然自动排产永远轮不到它们
    where: { status: 'scored', source: { in: ['source_item', 'web_search'] } },
    orderBy: [{ scoreTotal: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
  const items = []
  for (const t of topics) {
    const item = await prisma.contentItem.create({
      data: { topicId: t.id, title: t.title, kind: 'note', stage: 'research' },
    })
    await prisma.topic.update({ where: { id: t.id }, data: { status: 'in_production' } })
    items.push(item)
  }
  return items
}
