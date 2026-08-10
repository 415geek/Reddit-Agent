import { Suspense } from 'react'
import { BarChart3, TrendingUp, MapPin, AlertCircle, Target } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { IntentBadge } from '@/components/dashboard/intent-badge'
import { ScoreBar } from '@/components/dashboard/score-bar'
import { formatRelative } from '@/lib/utils'
import Link from 'next/link'
import { OverviewChart } from './overview-chart'

async function getOverviewData() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [total, relevant, highIntent, totalYest, relevantYest] = await Promise.all([
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since7d } } }),
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since7d }, isRelevant: true } }),
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since7d }, buyingIntent: 'high' } }),
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since24h } } }),
    prisma.marketvoicePost.count({ where: { createdAt: { gte: since24h }, isRelevant: true } }),
  ])

  const cityRows = await prisma.marketvoicePost.findMany({
    where: { createdAt: { gte: since7d }, isRelevant: true, detectedCity: { not: null } },
    select: { detectedCity: true },
  })

  const avgScore = await prisma.marketvoicePost.aggregate({
    where: { createdAt: { gte: since7d }, isRelevant: true },
    _avg: { leadScore: true },
  })

  const recentLeads = await prisma.marketvoicePost.findMany({
    where: { createdAt: { gte: since7d }, buyingIntent: 'high' },
    orderBy: [{ leadScore: 'desc' }, { postedAt: 'desc' }],
    take: 8,
    select: { id: true, title: true, subreddit: true, detectedCity: true, detectedState: true, leadScore: true, buyingIntent: true, summary: true, postedAt: true },
  })

  // Chart trend (7 days)
  const trendData = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d); end.setHours(23, 59, 59, 999)
    const count = await prisma.marketvoicePost.count({ where: { createdAt: { gte: d, lte: end }, isRelevant: true } })
    trendData.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count })
  }

  return {
    total, relevant, highIntent, totalYest, relevantYest,
    uniqueCities: new Set(cityRows.map(r => r.detectedCity)).size,
    avgScore: Math.round((avgScore._avg.leadScore || 0) * 10) / 10,
    recentLeads, trendData,
  }
}

export default async function OverviewPage() {
  const data = await getOverviewData()
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">National Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Last 7 days — Restaurant POS market signals from Reddit</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Posts Scanned" value={data.total.toLocaleString()} icon={<BarChart3 className="w-5 h-5" />} color="blue" />
        <StatCard title="Relevant Posts" value={data.relevant.toLocaleString()} icon={<Target className="w-5 h-5" />} color="green" />
        <StatCard title="High-Intent Leads" value={data.highIntent.toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} color="red" />
        <StatCard title="Cities Covered" value={data.uniqueCities.toLocaleString()} icon={<MapPin className="w-5 h-5" />} color="purple" />
        <StatCard title="Avg Lead Score" value={data.avgScore} icon={<AlertCircle className="w-5 h-5" />} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Relevant Posts Trend (7 days)</CardTitle></CardHeader>
            <CardContent>
              <OverviewChart data={data.trendData} />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Today's Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Posts scanned</span>
                <span className="font-semibold">{data.totalYest}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Relevant posts</span>
                <span className="font-semibold text-green-600">{data.relevantYest}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">High-intent leads</span>
                <span className="font-semibold text-red-600">{data.highIntent}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent High-Intent Leads</CardTitle>
            <Link href="/dashboard/leads" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.recentLeads.length === 0 && (
              <p className="p-6 text-sm text-gray-500 text-center">No high-intent leads yet. Make sure the n8n workflow is running.</p>
            )}
            {data.recentLeads.map(lead => (
              <Link key={lead.id} href={`/dashboard/posts/${lead.id}`} className="block px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{lead.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      r/{lead.subreddit}
                      {lead.detectedCity && ` · ${lead.detectedCity}${lead.detectedState ? `, ${lead.detectedState}` : ''}`}
                      {' · '}{formatRelative(lead.postedAt)}
                    </p>
                    {lead.summary && <p className="text-sm text-gray-600 mt-1 line-clamp-1">{lead.summary}</p>}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <IntentBadge intent={lead.buyingIntent || 'none'} />
                    <div className="w-20"><ScoreBar score={lead.leadScore} /></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
