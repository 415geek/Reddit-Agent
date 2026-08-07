import { cn } from '@/lib/utils'

/** 同 Select:手机上字号必须 ≥16px,否则 iOS 一聚焦就把页面放大 */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex min-h-[44px] sm:h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2',
        'text-base sm:text-sm placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
