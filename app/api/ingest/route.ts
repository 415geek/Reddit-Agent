import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const posts = Array.isArray(body) ? body : [body]
  const results = []

  for (const post of posts) {
    try {
      // Find or create source
      let source = await prisma.marketvoiceSource.findFirst({ where: { subreddit: post.subreddit } })
      if (!source) {
        source = await prisma.marketvoiceSource.create({
          data: {
            sourceName: post.subreddit,
            subreddit: post.subreddit,
            rssUrl: `https://www.reddit.com/r/${post.subreddit}/new/.rss`,
            sourceType: 'city',
            active: true,
          },
        })
      }

      const saved = await prisma.marketvoicePost.upsert({
        where: { url: post.url },
        update: {
          isRelevant: post.is_relevant ?? false,
          detectedCity: post.detected_city,
          detectedState: post.detected_state,
          locationConfidence: post.location_confidence,
          businessType: post.business_type,
          asianRestaurantSignal: post.asian_restaurant_signal ?? false,
          cuisineType: post.cuisine_type,
          topicCategory: post.topic_category,
          competitorsMentioned: post.competitors_mentioned ?? [],
          painPoints: post.pain_points ?? [],
          buyingIntent: post.buying_intent,
          leadScore: post.lead_score ?? 0,
          marketScore: post.market_score ?? 0,
          summary: post.summary,
          suggestedAction: post.suggested_action,
          salesAngle: post.sales_angle,
          aiRawResponse: JSON.stringify(post),
        },
        create: {
          sourceId: source.id,
          subreddit: post.subreddit,
          title: post.title,
          url: post.url,
          author: post.author,
          postedAt: new Date(post.posted_at || Date.now()),
          rawContent: post.content,
          matchedKeywords: post.matched_keywords ?? [],
          isRelevant: post.is_relevant ?? false,
          detectedCity: post.detected_city,
          detectedState: post.detected_state,
          locationConfidence: post.location_confidence,
          businessType: post.business_type,
          asianRestaurantSignal: post.asian_restaurant_signal ?? false,
          cuisineType: post.cuisine_type,
          topicCategory: post.topic_category,
          competitorsMentioned: post.competitors_mentioned ?? [],
          painPoints: post.pain_points ?? [],
          buyingIntent: post.buying_intent,
          leadScore: post.lead_score ?? 0,
          marketScore: post.market_score ?? 0,
          summary: post.summary,
          suggestedAction: post.suggested_action,
          salesAngle: post.sales_angle,
          aiRawResponse: JSON.stringify(post),
        },
      })
      results.push({ url: post.url, status: 'saved', id: saved.id })
    } catch (e) {
      results.push({ url: post.url, status: 'error', error: String(e) })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
