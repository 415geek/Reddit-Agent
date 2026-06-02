import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getDateRange(range: string) {
  const now = new Date()
  switch (range) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default: return new Date(0)
  }
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || '7d'
  const now = new Date()
  const since = getDateRange(range)

  const [totalScanned, relevantPosts, highIntentLeads, cityRows, avgScoreResult] = await Promise.all([
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since } } }),
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since }, isRelevant: true } }),
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since }, buyingIntent: 'high' } }),
    prisma.marketvoicePost.findMany({
      where: { createdAt: { gte: since }, isRelevant: true, detectedCity: { not: null } },
      select: { detectedCity: true, detectedState: true },
    }),
    prisma.marketvoicePost.aggregate({
      where: { createdAt: { gte: since }, isRelevant: true },
      _avg: { leadScore: true },
    }),
  ])

  const uniqueCities = new Set(cityRows.map(r => r.detectedCity).filter(Boolean))

  // Trend data (daily counts for chart)
  const days = range === '24h' ? 1 : range === '7d' ? 7 : 30
  const trendData = []
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)
    const count = await prisma.marketvoicePost.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd }, isRelevant: true },
    })
    trendData.push({ date: dayStart.toISOString().split('T')[0], count })
  }

  return NextResponse.json({
    totalPostsScanned: totalScanned,
    relevantPosts,
    highIntentLeads,
    coveredCities: uniqueCities.size,
    avgLeadScore: Math.round((avgScoreResult._avg.leadScore || 0) * 10) / 10,
    trendData,
  })
}
