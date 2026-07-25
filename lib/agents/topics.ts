import { prisma } from '../prisma'
import { generateJSON } from '../ai'
import { SCORE_QUEUE_THRESHOLD, TopicCandidate, TopicScore } from '../domain'
import {
  TOPIC_GENERATOR_SYSTEM,
  TOPIC_SCORER_SYSTEM,
  topicGeneratorUser,
  topicScorerUser,
} from '../prompts'
import { logEvent } from './events'

/** 选题Agent:生成候选 → 评分 → 风险淘汰 → 入库 */
export async function generateAndScoreTopics(count = 30) {
  await logEvent({ stage: 'topics_generate', status: 'started', detail: { count } })
  try {
    const recent = await prisma.topic.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { title: true },
    })
    const candidates = await generateJSON<TopicCandidate[]>({
      system: TOPIC_GENERATOR_SYSTEM,
      user: topicGeneratorUser(count, recent.map((t) => t.title)),
      maxTokens: 8192,
      mockKey: 'topics.generate',
    })

    const existing = new Set(recent.map((t) => t.title))
    const fresh = candidates.filter((c) => c.title && !existing.has(c.title))

    const scores = await generateJSON<TopicScore[]>({
      system: TOPIC_SCORER_SYSTEM,
      user: topicScorerUser(fresh.map((c) => ({ title: c.title, hook: c.hook }))),
      maxTokens: 8192,
      mockKey: 'topics.score',
      mockParams: { titles: fresh.map((c) => c.title) },
    })
    const scoreByTitle = new Map(scores.map((s) => [s.title, s]))

    let saved = 0
    let rejected = 0
    for (const c of fresh) {
      const s = scoreByTitle.get(c.title)
      const risky = (s?.riskFlags?.length ?? 0) > 0
      const total = s?.total ?? null
      await prisma.topic.create({
        data: {
          title: c.title,
          hook: c.hook,
          category: c.category,
          region: c.region,
          source: 'daily',
          status: risky ? 'rejected' : 'scored',
          scoreTotal: total,
          scores: (s?.scores ?? undefined) as object | undefined,
          riskFlags: s?.riskFlags ?? [],
        },
      })
      risky ? rejected++ : saved++
    }

    const result = { generated: candidates.length, saved, rejected, threshold: SCORE_QUEUE_THRESHOLD }
    await logEvent({ stage: 'topics_generate', status: 'succeeded', detail: result })
    return result
  } catch (e) {
    await logEvent({ stage: 'topics_generate', status: 'failed', error: String(e) })
    throw e
  }
}

/** 把评分达标的选题头部入队并创建生产单元 */
export async function queueTopTopics(limit = 5) {
  const topics = await prisma.topic.findMany({
    where: { status: { in: ['idea', 'scored'] }, scoreTotal: { gte: SCORE_QUEUE_THRESHOLD } },
    orderBy: { scoreTotal: 'desc' },
    take: limit,
  })
  const items = []
  for (const t of topics) {
    const item = await prisma.contentItem.create({
      data: { topicId: t.id, title: t.title, stage: 'research' },
    })
    await prisma.topic.update({ where: { id: t.id }, data: { status: 'in_production' } })
    items.push(item)
  }
  return items
}
