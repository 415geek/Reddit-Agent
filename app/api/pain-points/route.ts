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
    where: { createdAt: { gte: since }, isRelevant: true, painPoints: { isEmpty: false } },
    select: { painPoints: true, buyingIntent: true, leadScore: true },
  })

  const ppMap: Record<string, { count: number; highIntentCount: number; totalScore: number }> = {}

  for (const post of posts) {
    for (const pp of post.painPoints) {
      if (!ppMap[pp]) ppMap[pp] = { count: 0, highIntentCount: 0, totalScore: 0 }
      ppMap[pp].count++
      ppMap[pp].totalScore += post.leadScore
      if (post.buyingIntent === 'high') ppMap[pp].highIntentCount++
    }
  }

  const painPoints = Object.entries(ppMap)
    .map(([name, data]) => ({
      name,
      count: data.count,
      highIntentCount: data.highIntentCount,
      avgLeadScore: Math.round((data.totalScore / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return NextResponse.json({ painPoints })
}
