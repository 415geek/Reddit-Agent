import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'

async function getPainPoints(range: string) {
  const since = range === '7d' ? new Date(Date.now() - 7 * 86400000) : new Date(Date.now() - 30 * 86400000)
  const posts = await prisma.marketvoicePost.findMany({
    where: { createdAt: { gte: since }, isRelevant: true, painPoints: { isEmpty: false } },
    select: { painPoints: true, buyingIntent: true, leadScore: true },
  })
  const map: Record<string, { count: number; highIntentCount: number; totalScore: number }> = {}
  for (const p of posts) {
    for (const pp of p.painPoints) {
      if (!map[pp]) map[pp] = { count: 0, highIntentCount: 0, totalScore: 0 }
      map[pp].count++; map[pp].totalScore += p.leadScore
      if (p.buyingIntent === 'high') map[pp].highIntentCount++
    }
  }
  return Object.entries(map).map(([name, d]) => ({
    name, count: d.count, highIntentCount: d.highIntentCount,
    avgLeadScore: Math.round((d.totalScore / d.count) * 10) / 10,
  })).sort((a, b) => b.count - a.count).slice(0, 20)
}

export default async function PainPointsPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams.range || '30d'
  const painPoints = await getPainPoints(range)
  const maxCount = painPoints[0]?.count || 1
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Pain Point Ranking</h1><p className="text-sm text-gray-500 mt-1">Most common restaurant operator pain points</p></div>
        <div className="flex gap-2">
          {['7d','30d'].map(r => (
            <a key={r} href={`/dashboard/pain-points?range=${r}`} className={`px-3 py-1.5 rounded text-sm font-medium ${range === r ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{r === '7d' ? '7 days' : '30 days'}</a>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          {painPoints.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No pain point data yet.</p>
          ) : (
            <div className="space-y-4">
              {painPoints.map((pp, idx) => (
                <div key={pp.name} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-400 w-6">#{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{pp.name}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-red-600 font-medium">{pp.highIntentCount} high-intent</span>
                        <span className="text-gray-500">{pp.count} mentions</span>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(pp.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
