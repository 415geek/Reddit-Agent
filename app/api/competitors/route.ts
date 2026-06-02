import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const TRACKED_COMPETITORS = ['Toast', 'Square', 'Clover', 'Lightspeed', 'SpotOn', 'Revel', 'Menusifu', 'Chowbus']

function getDateRange(range: string) {
  const now = new Date()
  switch (range) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || '30d'
  const since = getDateRange(range)

  const posts = await prisma.marketvoicePost.findMany({
    where: {
      createdAt: { gte: since },
      isRelevant: true,
      competitorsMentioned: { isEmpty: false },
    },
    select: { competitorsMentioned: true, painPoints: true, buyingIntent: true, leadScore: true },
  })

  const compMap: Record<string, { mentionCount: number; highIntentCount: number; painPoints: Record<string, number>; totalScore: number }> = {}

  for (const comp of TRACKED_COMPETITORS) {
    compMap[comp] = { mentionCount: 0, highIntentCount: 0, painPoints: {}, totalScore: 0 }
  }

  for (const post of posts) {
    for (const comp of post.competitorsMentioned) {
      const normalized = TRACKED_COMPETITORS.find(c => c.toLowerCase() === comp.toLowerCase()) || comp
      if (!compMap[normalized]) compMap[normalized] = { mentionCount: 0, highIntentCount: 0, painPoints: {}, totalScore: 0 }
      compMap[normalized].mentionCount++
      compMap[normalized].totalScore += post.leadScore
      if (post.buyingIntent === 'high') compMap[normalized].highIntentCount++
      for (const pp of post.painPoints) {
        compMap[normalized].painPoints[pp] = (compMap[normalized].painPoints[pp] || 0) + 1
      }
    }
  }

  const competitors = Object.entries(compMap)
    .map(([name, data]) => ({
      name,
      mentionCount: data.mentionCount,
      highIntentCount: data.highIntentCount,
      avgLeadScore: data.mentionCount > 0 ? Math.round((data.totalScore / data.mentionCount) * 10) / 10 : 0,
      topPainPoints: Object.entries(data.painPoints).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
    }))
    .sort((a, b) => b.mentionCount - a.mentionCount)

  return NextResponse.json({ competitors })
}
