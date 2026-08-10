import { prisma } from '@/lib/prisma'
import { IntentBadge } from '@/components/dashboard/intent-badge'
import { ScoreBar } from '@/components/dashboard/score-bar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatRelative } from '@/lib/utils'
import Link from 'next/link'
import { LeadsFilters } from './leads-filters'

interface LeadsPageProps {
  searchParams: { range?: string; intent?: string; city?: string; minScore?: string; page?: string }
}

async function getLeads(params: LeadsPageProps['searchParams']) {
  const range = params.range || '7d'
  const now = new Date()
  const since = range === '24h' ? new Date(now.getTime() - 86400000)
    : range === '7d' ? new Date(now.getTime() - 7 * 86400000)
    : range === '30d' ? new Date(now.getTime() - 30 * 86400000)
    : new Date(0)
  const page = parseInt(params.page || '1')
  const limit = 25

  const where: any = { createdAt: { gte: since }, isRelevant: true }
  if (params.intent) where.buyingIntent = params.intent
  if (params.city) where.detectedCity = { contains: params.city, mode: 'insensitive' }
  if (params.minScore) where.leadScore = { gte: parseInt(params.minScore) }

  const [posts, total] = await Promise.all([
    prisma.marketvoicePost.findMany({
      where, orderBy: [{ leadScore: 'desc' }, { postedAt: 'desc' }],
      skip: (page - 1) * limit, take: limit,
      select: { id: true, title: true, url: true, subreddit: true, author: true, postedAt: true,
        detectedCity: true, detectedState: true, leadScore: true, buyingIntent: true,
        painPoints: true, competitorsMentioned: true, summary: true, topicCategory: true },
    }),
    prisma.marketvoicePost.count({ where }),
  ])
  return { posts, total, page, pages: Math.ceil(total / limit) }
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const { posts, total, page, pages } = await getLeads(searchParams)
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">High Intent Leads</h1>
        <p className="text-sm text-gray-500 mt-1">{total} leads found · Sorted by lead score</p>
      </div>
      <LeadsFilters searchParams={searchParams} />
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Competitors</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-12">No leads found. Adjust filters or wait for the n8n workflow to run.</TableCell></TableRow>
              )}
              {posts.map(post => (
                <TableRow key={post.id}>
                  <TableCell className="max-w-xs">
                    <Link href={`/dashboard/posts/${post.id}`} className="font-medium text-blue-600 hover:underline line-clamp-2">
                      {post.title}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">r/{post.subreddit}</div>
                    {post.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.summary}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {post.detectedCity ? `${post.detectedCity}${post.detectedState ? `, ${post.detectedState}` : ''}` : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell><IntentBadge intent={post.buyingIntent || 'none'} /></TableCell>
                  <TableCell className="w-28"><ScoreBar score={post.leadScore} /></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {post.competitorsMentioned.slice(0, 2).map(c => <Badge key={c} variant="outline">{c}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-gray-500">{formatRelative(post.postedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`/dashboard/leads?page=${p}&range=${searchParams.range || '7d'}`}
              className={`px-3 py-1.5 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
