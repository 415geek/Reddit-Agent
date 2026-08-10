import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  icon?: React.ReactNode
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'purple'
}

export function StatCard({ title, value, change, icon, color = 'blue' }: StatCardProps) {
  const colors = {
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    purple: 'text-purple-600 bg-purple-50',
  }
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
            {change && <p className="mt-1 text-xs text-gray-500">{change}</p>}
          </div>
          {icon && (
            <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0', colors[color])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
