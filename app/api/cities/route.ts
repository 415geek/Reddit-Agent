import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    where: { createdAt: { gte: since }, isRelevant: true, detectedCity: { not: null } },
    select: { detectedCity: true, detectedState: true, leadScore: true, buyingIntent: true, painPoints: true },
  })

  const cityMap: Record<string, { city: string; state: string; postCount: number; highIntentCount: number; totalScore: number; painPoints: Record<string, number> }> = {}

  for (const post of posts) {
    if (!post.detectedCity) continue
    const key = `${post.detectedCity}|${post.detectedState}`
    if (!cityMap[key]) {
      cityMap[key] = { city: post.detectedCity, state: post.detectedState || '', postCount: 0, highIntentCount: 0, totalScore: 0, painPoints: {} }
    }
    cityMap[key].postCount++
    cityMap[key].totalScore += post.leadScore
    if (post.buyingIntent === 'high') cityMap[key].highIntentCount++
    for (const pp of post.painPoints) {
      cityMap[key].painPoints[pp] = (cityMap[key].painPoints[pp] || 0) + 1
    }
  }

  const cities = Object.values(cityMap)
    .map(c => ({
      city: c.city,
      state: c.state,
      postCount: c.postCount,
      highIntentCount: c.highIntentCount,
      avgLeadScore: Math.round((c.totalScore / c.postCount) * 10) / 10,
      topPainPoints: Object.entries(c.painPoints).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    }))
    .sort((a, b) => b.highIntentCount - a.highIntentCount || b.postCount - a.postCount)
    .slice(0, 20)

  return NextResponse.json({ cities })
}
