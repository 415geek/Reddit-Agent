import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

const TRACKED_COMPETITORS = ['Toast', 'Square', 'Clover', 'Lightspeed', 'SpotOn', 'Revel', 'Menusifu', 'Chowbus']
const COMP_COLORS: Record<string, string> = {
  Toast: 'border-orange-200 bg-orange-50', Square: 'border-blue-200 bg-blue-50',
  Clover: 'border-green-200 bg-green-50', Lightspeed: 'border-purple-200 bg-purple-50',
  SpotOn: 'border-red-200 bg-red-50', Revel: 'border-indigo-200 bg-indigo-50',
  Menusifu: 'border-yellow-200 bg-yellow-50', Chowbus: 'border-pink-200 bg-pink-50',
}

async function getCompetitorData(range: string) {
  const since = range === '7d' ? new Date(Date.now() - 7 * 86400000) : new Date(Date.now() - 30 * 86400000)
  const posts = await prisma.marketvoicePost.findMany({
    where: { createdAt: { gte: since }, isRelevant: true, competitorsMentioned: { isEmpty: false } },
    select: { competitorsMentioned: true, painPoints: true, buyingIntent: true, leadScore: true },
  })
  const map: Record<string, { mentionCount: number; highIntentCount: number; painPoints: Record<string, number>; totalScore: number }> = {}
  for (const comp of TRACKED_COMPETITORS) map[comp] = { mentionCount: 0, highIntentCount: 0, painPoints: {}, totalScore: 0 }
  for (const post of posts) {
    for (const c of post.competitorsMentioned) {
      const norm = TRACKED_COMPETITORS.find(t => t.toLowerCase() === c.toLowerCase()) || c
      if (!map[norm]) map[norm] = { mentionCount: 0, highIntentCount: 0, painPoints: {}, totalScore: 0 }
      map[norm].mentionCount++; map[norm].totalScore += post.leadScore
      if (post.buyingIntent === 'high') map[norm].highIntentCount++
      for (const pp of post.painPoints) map[norm].painPoints[pp] = (map[norm].painPoints[pp] || 0) + 1
    }
  }
  return Object.entries(map).map(([name, d]) => ({
    name, mentionCount: d.mentionCount, highIntentCount: d.highIntentCount,
    avgLeadScore: d.mentionCount > 0 ? Math.round((d.totalScore / d.mentionCount) * 10) / 10 : 0,
    topPainPoints: Object.entries(d.painPoints).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
  })).sort((a, b) => b.mentionCount - a.mentionCount)
}

export default async function CompetitorsPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams.range || '30d'
  const competitors = await getCompetitorData(range)
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Competitor Pain Map</h1><p className="text-sm text-gray-500 mt-1">Track competitor complaints and switching signals</p></div>
        <div className="flex gap-2">
          {['7d','30d'].map(r => (
            <a key={r} href={`/dashboard/competitors?range=${r}`} className={`px-3 py-1.5 rounded text-sm font-medium ${range === r ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{r === '7d' ? '7 days' : '30 days'}</a>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {competitors.map(comp => (
          <Card key={comp.name} className={`border-2 ${COMP_COLORS[comp.name] || ''} hover:shadow-md transition-shadow`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-lg">{comp.name}</h3>
                <AlertCircle className={`w-5 h-5 ${comp.mentionCount > 0 ? 'text-red-500' : 'text-gray-300'}`} />
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Mentions</span><span className="font-bold text-gray-900 text-xl">{comp.mentionCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">High-intent</span><span className="font-semibold text-red-600">{comp.highIntentCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Avg score</span><span className="font-medium">{comp.avgLeadScore}</span></div>
              </div>
              {comp.topPainPoints.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Top pain points:</p>
                  <div className="flex flex-wrap gap-1">
                    {comp.topPainPoints.map(pp => <Badge key={pp} variant="outline" className="text-xs">{pp}</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
