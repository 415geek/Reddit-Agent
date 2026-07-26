import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  icon?: React.ReactNode
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'purple'
}

/**
 * 手机上标题和数字上下排、图标缩到右上角。
 * 原来是"文字 + 48px 图标"左右并排,窄屏下文字栏被挤到几十像素宽,
 * 中文标题就一个字一行竖着排下来了。
 */
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
      <CardContent className="p-3.5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs sm:text-sm font-medium text-gray-500 leading-snug">{title}</p>
          {icon && (
            <div
              className={cn(
                'rounded-lg flex items-center justify-center flex-shrink-0',
                'w-8 h-8 sm:w-12 sm:h-12 [&_svg]:w-4 [&_svg]:h-4 sm:[&_svg]:w-6 sm:[&_svg]:h-6',
                colors[color],
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
        {change && <p className="mt-0.5 text-xs text-gray-500">{change}</p>}
      </CardContent>
    </Card>
  )
}
