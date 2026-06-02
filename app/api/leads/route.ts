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
  const p = req.nextUrl.searchParams
  const range = p.get('range') || '7d'
  const intent = p.get('intent')
  const city = p.get('city')
  const state = p.get('state')
  const subreddit = p.get('subreddit')
  const competitor = p.get('competitor')
  const minScore = parseInt(p.get('minScore') || '0')
  const topicCategory = p.get('topicCategory')
  const asianSignal = p.get('asianSignal')
  const page = parseInt(p.get('page') || '1')
  const limit = parseInt(p.get('limit') || '20')

  const since = getDateRange(range)
  const where: any = { createdAt: { gte: since }, isRelevant: true }

  if (intent) where.buyingIntent = intent
  if (city) where.detectedCity = { contains: city, mode: 'insensitive' }
  if (state) where.detectedState = state
  if (subreddit) where.subreddit = subreddit
  if (competitor) where.competitorsMentioned = { has: competitor }
  if (minScore > 0) where.leadScore = { gte: minScore }
  if (topicCategory) where.topicCategory = topicCategory
  if (asianSignal === 'true') where.asianRestaurantSignal = true

  const [posts, total] = await Promise.all([
    prisma.marketvoicePost.findMany({
      where,
      orderBy: [{ leadScore: 'desc' }, { postedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, subreddit: true, url: true, author: true,
        postedAt: true, detectedCity: true, detectedState: true,
        leadScore: true, marketScore: true, buyingIntent: true,
        painPoints: true, competitorsMentioned: true, summary: true,
        suggestedAction: true, salesAngle: true, topicCategory: true,
        businessType: true, asianRestaurantSignal: true, cuisineType: true,
        matchedKeywords: true, createdAt: true,
      },
    }),
    prisma.marketvoicePost.count({ where }),
  ])

  return NextResponse.json({ posts, total, page, limit, pages: Math.ceil(total / limit) })
}
