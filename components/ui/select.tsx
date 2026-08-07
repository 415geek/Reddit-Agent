import { cn } from '@/lib/utils'

/**
 * text-base(16px)不是审美选择:iOS Safari 在字号小于 16px 的表单控件获得焦点时
 * 会自动放大整个页面,放大后不会自己缩回去,用户得手动双指捏合。
 * 桌面上再收回 14px。
 */
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex min-h-[44px] sm:h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2',
        'text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
        className,
      )}
      {...props}
    />
  )
}
