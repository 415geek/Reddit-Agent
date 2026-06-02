import { Select } from '@/components/ui/select'

interface HeaderProps {
  title: string
  subtitle?: string
  range?: string
  onRangeChange?: (range: string) => void
  showRangeFilter?: boolean
}

export function Header({ title, subtitle, range = '7d', onRangeChange, showRangeFilter = true }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {showRangeFilter && onRangeChange && (
        <Select value={range} onChange={e => onRangeChange(e.target.value)} className="w-32">
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </Select>
      )}
    </div>
  )
}
