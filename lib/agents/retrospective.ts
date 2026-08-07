import { prisma } from '../prisma'
import { generateJSON } from '../ai'
import { TopicCandidate } from '../domain'
import { RETROSPECTIVE_SYSTEM, retrospectiveUser } from '../prompts'
import { logEvent } from './events'

interface RetroOutput {
  summary: string
  recommendations: Array<{ type: 'sequel' | 'adjust' | 'retire'; topicTitle: string; reason: string }>
  sequelTopics?: TopicCandidate[]
}

/** 账号自身基准:所有已发布内容各指标的平均值(不看外部"爆款标准值") */
export async function accountBaseline() {
  const snapshots = await prisma.metricSnapshot.findMany({
    include: { publication: { include: { contentItem: { include: { topic: true } } } } },
  })
  if (snapshots.length === 0) return null
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return {
    sampleSize: snapshots.length,
    avgPlays: Math.round(avg(snapshots.map((s) => s.plays))),
    avgCompletionRate: avg(snapshots.map((s) => s.completionRate ?? 0)),
    avgLikeRate: avg(snapshots.map((s) => (s.plays ? s.likes / s.plays : 0))),
    avgFavoriteRate: avg(snapshots.map((s) => (s.plays ? s.favorites / s.plays : 0))),
    avgShareRate: avg(snapshots.map((s) => (s.plays ? s.shares / s.plays : 0))),
    avgCommentRate: avg(snapshots.map((s) => (s.plays ? s.comments / s.plays : 0))),
    avgFollowersPer1k: avg(snapshots.map((s) => (s.plays ? (s.followersDelta / s.plays) * 1000 : 0))),
  }
}

/** 复盘Agent:汇总数据 → AI 分析 → 存 Insight → 自动生成续集选题 */
export async function runRetrospective(periodDays = 7) {
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - periodDays * 86400000)
  await logEvent({ stage: 'retrospective', status: 'started' })
  try {
    const baseline = await accountBaseline()
    const recent = await prisma.publication.findMany({
      where: { publishedAt: { gte: periodStart } },
      include: {
        metrics: true,
        contentItem: { include: { topic: { include: { series: true } } } },
      },
    })
    const data = {
      baseline,
      publications: recent.map((p) => ({
        title: p.contentItem.title,
        category: p.contentItem.topic.category,
        region: p.contentItem.topic.region,
        series: p.contentItem.topic.series?.name ?? null,
        coverTemplate: p.contentItem.coverTemplate,
        publishedAt: p.publishedAt,
        metrics: p.metrics.map((m) => ({
          atHours: m.atHours,
          plays: m.plays,
          completionRate: m.completionRate,
          likes: m.likes,
          favorites: m.favorites,
          shares: m.shares,
          comments: m.comments,
          followersDelta: m.followersDelta,
        })),
      })),
    }

    const out = await generateJSON<RetroOutput>({
      system: RETROSPECTIVE_SYSTEM,
      user: retrospectiveUser(data),
      maxTokens: 4096,
      mockKey: 'retrospective',
    })

    const insight = await prisma.insight.create({
      data: {
        periodStart,
        periodEnd,
        summary: out.summary,
        recommendations: out.recommendations as unknown as object,
      },
    })

    // 续集选题自动入库(source=sequel,进入选题池等待评分/入队)
    let sequels = 0
    for (const t of out.sequelTopics ?? []) {
      const exists = await prisma.topic.findFirst({ where: { title: t.title } })
      if (exists) continue
      await prisma.topic.create({
        data: { title: t.title, hook: t.hook, category: t.category, region: t.region, source: 'sequel', status: 'idea' },
      })
      sequels++
    }

    // 停产建议:把 retire 建议对应的选题标记 retired
    for (const rec of out.recommendations.filter((r) => r.type === 'retire')) {
      await prisma.topic.updateMany({ where: { title: rec.topicTitle }, data: { status: 'retired' } })
    }

    await logEvent({ stage: 'retrospective', status: 'succeeded', detail: { insightId: insight.id, sequels } })
    return { insightId: insight.id, summary: out.summary, sequels }
  } catch (e) {
    await logEvent({ stage: 'retrospective', status: 'failed', error: String(e) })
    throw e
  }
}
