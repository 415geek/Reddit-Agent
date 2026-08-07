import { cn } from '@/lib/utils'

// 内边距在手机上收一档:393px 宽的屏幕上 p-6 两边就吃掉 48px,
// 正文只剩三百出头,中文标题很容易被挤成两行。
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border bg-white shadow-sm', className)} {...props} />
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-4 sm:p-6', className)} {...props} />
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base sm:text-lg font-semibold leading-snug tracking-tight', className)} {...props} />
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
}
