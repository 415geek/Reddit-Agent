import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScoreBar } from '@/components/dashboard/score-bar'
import { MapPin, TrendingUp } from 'lucide-react'

interface CityData { city: string; state: string; postCount: number; highIntentCount: number; avgLeadScore: number; topPainPoints: string[] }

async function getCities(range: string): Promise<CityData[]> {
  const since = range === '7d' ? new Date(Date.now() - 7 * 86400000) : new Date(Date.now() - 30 * 86400000)
  const posts = await prisma.marketvoicePost.findMany({
    where: { createdAt: { gte: since }, isRelevant: true, detectedCity: { not: null } },
    select: { detectedCity: true, detectedState: true, leadScore: true, buyingIntent: true, painPoints: true },
  })
  const map: Record<string, { city: string; state: string; postCount: number; highIntentCount: number; totalScore: number; painPoints: Record<string, number> }> = {}
  for (const p of posts) {
    if (!p.detectedCity) continue
    const key = `${p.detectedCity}|${p.detectedState}`
    if (!map[key]) map[key] = { city: p.detectedCity, state: p.detectedState || '', postCount: 0, highIntentCount: 0, totalScore: 0, painPoints: {} }
    map[key].postCount++; map[key].totalScore += p.leadScore
    if (p.buyingIntent === 'high') map[key].highIntentCount++
    for (const pp of p.painPoints) map[key].painPoints[pp] = (map[key].painPoints[pp] || 0) + 1
  }
  return Object.values(map)
    .map(c => ({ city: c.city, state: c.state, postCount: c.postCount, highIntentCount: c.highIntentCount, avgLeadScore: Math.round((c.totalScore / c.postCount) * 10) / 10, topPainPoints: Object.entries(c.painPoints).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k) }))
    .sort((a, b) => b.highIntentCount - a.highIntentCount || b.postCount - a.postCount)
    .slice(0, 20)
}

export default async function CitiesPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams.range || '30d'
  const cities = await getCities(range)
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">City Ranking</h1><p className="text-sm text-gray-500 mt-1">Markets ranked by high-intent lead activity</p></div>
        <div className="flex gap-2">
          {['7d','30d'].map(r => (
            <a key={r} href={`/dashboard/cities?range=${r}`} className={`px-3 py-1.5 rounded text-sm font-medium ${range === r ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{r === '7d' ? '7 days' : '30 days'}</a>
          ))}
        </div>
      </div>
      {cities.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">No city data yet. Run the n8n workflow to collect posts.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cities.map((city, idx) => (
            <Card key={`${city.city}-${city.state}`} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-300 w-7">#{idx + 1}</span>
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{city.city}</div>
                      <div className="text-xs text-gray-500">{city.state}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-red-600 font-bold"><TrendingUp className="w-3.5 h-3.5" />{city.highIntentCount}</div>
                    <div className="text-xs text-gray-500">high-intent</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm mb-3">
                  <div className="flex justify-between"><span className="text-gray-500">Total posts</span><span className="font-medium">{city.postCount}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Avg lead score</span><div className="w-24"><ScoreBar score={city.avgLeadScore} /></div></div>
                </div>
                {city.topPainPoints.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {city.topPainPoints.map(pp => <Badge key={pp} variant="outline" className="text-xs">{pp}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
