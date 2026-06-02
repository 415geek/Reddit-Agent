'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface LeadsFiltersProps {
  searchParams: Record<string, string | undefined>
}

export function LeadsFilters({ searchParams }: LeadsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams as Record<string, string>)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3 p-4 bg-white rounded-lg border">
      <Select value={searchParams.range || '7d'} onChange={e => updateParam('range', e.target.value)} className="w-32">
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="all">All time</option>
      </Select>
      <Select value={searchParams.intent || ''} onChange={e => updateParam('intent', e.target.value)} className="w-36">
        <option value="">All intent</option>
        <option value="high">🔥 High</option>
        <option value="medium">⚡ Medium</option>
        <option value="low">○ Low</option>
        <option value="none">— None</option>
      </Select>
      <Select value={searchParams.minScore || ''} onChange={e => updateParam('minScore', e.target.value)} className="w-36">
        <option value="">Any score</option>
        <option value="7">Score 7+</option>
        <option value="8">Score 8+</option>
        <option value="9">Score 9+</option>
      </Select>
      <Input
        placeholder="Filter by city..."
        defaultValue={searchParams.city || ''}
        className="w-40"
        onKeyDown={e => { if (e.key === 'Enter') updateParam('city', (e.target as HTMLInputElement).value) }}
      />
      {Object.values(searchParams).some(Boolean) && (
        <Button variant="outline" size="sm" onClick={() => router.push(pathname)}>Clear filters</Button>
      )}
    </div>
  )
}
