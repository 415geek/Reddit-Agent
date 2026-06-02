import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IntentBadge } from '@/components/dashboard/intent-badge'
import { ScoreBar } from '@/components/dashboard/score-bar'
import { formatDate } from '@/lib/utils'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const post = await prisma.marketvoicePost.findUnique({
    where: { id: params.id },
    include: { source: true },
  })
  if (!post) notFound()

  return (
    <div>
      <Link href="/dashboard/leads" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl leading-snug">{post.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-sm text-gray-500">r/{post.subreddit}</span>
                {post.author && <span className="text-sm text-gray-400">by u/{post.author}</span>}
                <span className="text-sm text-gray-400">· {formatDate(post.postedAt)}</span>
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  View on Reddit <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardHeader>
            {post.rawContent && (
              <CardContent>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {post.rawContent}
                </div>
              </CardContent>
            )}
          </Card>

          {post.summary && (
            <Card>
              <CardHeader><CardTitle>AI Summary</CardTitle></CardHeader>
              <CardContent><p className="text-gray-700">{post.summary}</p></CardContent>
            </Card>
          )}

          {post.suggestedAction && (
            <Card>
              <CardHeader><CardTitle>Suggested BD Action</CardTitle></CardHeader>
              <CardContent><p className="text-gray-700">{post.suggestedAction}</p></CardContent>
            </Card>
          )}

          {post.salesAngle && (
            <Card>
              <CardHeader><CardTitle>Sales Angle</CardTitle></CardHeader>
              <CardContent><p className="text-gray-700">{post.salesAngle}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Scoring</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><p className="text-sm text-gray-500 mb-2">Lead Score</p><ScoreBar score={post.leadScore} /></div>
              <div><p className="text-sm text-gray-500 mb-2">Market Score</p><ScoreBar score={post.marketScore} /></div>
              <div><p className="text-sm text-gray-500 mb-1">Buying Intent</p><IntentBadge intent={post.buyingIntent || 'none'} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {post.detectedCity && <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="font-medium">{post.detectedCity}{post.detectedState ? `, ${post.detectedState}` : ''}</span></div>}
              {post.businessType && <div className="flex justify-between"><span className="text-gray-500">Business type</span><span className="font-medium capitalize">{post.businessType}</span></div>}
              {post.cuisineType && <div className="flex justify-between"><span className="text-gray-500">Cuisine</span><span className="font-medium">{post.cuisineType}</span></div>}
              {post.topicCategory && <div className="flex justify-between"><span className="text-gray-500">Topic</span><span className="font-medium">{post.topicCategory.replace(/_/g, ' ')}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Asian signal</span><span>{post.asianRestaurantSignal ? '✅ Yes' : 'No'}</span></div>
            </CardContent>
          </Card>

          {post.competitorsMentioned.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Competitors Mentioned</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-2">{post.competitorsMentioned.map(c => <Badge key={c} variant="high">{c}</Badge>)}</div></CardContent>
            </Card>
          )}

          {post.painPoints.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Pain Points</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-2">{post.painPoints.map(pp => <Badge key={pp} variant="outline">{pp}</Badge>)}</div></CardContent>
            </Card>
          )}

          {post.matchedKeywords.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Matched Keywords</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-1">{post.matchedKeywords.map(kw => <Badge key={kw} className="text-xs">{kw}</Badge>)}</div></CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
