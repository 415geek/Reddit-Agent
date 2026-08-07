import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWebhookSecret } from '@/lib/webhook'
import { SERIES, TOPICS } from '@/prisma/seed-data/topics'

export const maxDuration = 60

/** 一次性种子接口(幂等):写入系列 + 选题库。用 x-webhook-secret 保护。 */
export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied

  const seriesBySlug = new Map<string, string>()
  for (const s of SERIES) {
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: { name: s.name, description: s.description },
      create: { slug: s.slug, name: s.name, description: s.description },
    })
    seriesBySlug.set(s.slug, row.id)
  }

  const existing = new Set((await prisma.topic.findMany({ select: { title: true } })).map((t) => t.title))
  const toCreate = TOPICS.filter((t) => !existing.has(t.title)).map((t) => ({
    title: t.title,
    hook: t.hook,
    category: t.category,
    region: t.region,
    seriesId: t.seriesSlug ? seriesBySlug.get(t.seriesSlug) : undefined,
    source: 'seed',
    status: 'idea',
  }))
  if (toCreate.length > 0) {
    await prisma.topic.createMany({ data: toCreate })
  }

  const total = await prisma.topic.count()
  return NextResponse.json({ ok: true, series: SERIES.length, created: toCreate.length, totalTopics: total })
}
