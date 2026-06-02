import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'high' | 'medium' | 'low' | 'none' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    high: 'bg-red-100 text-red-800 font-semibold',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
    none: 'bg-gray-100 text-gray-600',
    outline: 'border border-gray-300 text-gray-700',
  }
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs', variants[variant], className)}
      {...props}
    />
  )
}
