import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonProps) {
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
    ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
    destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  }
  // 高度按 iOS 的 44pt 最小可点区域给。sm 也保 40px——
  // 桌面上鼠标能点中 28px 的按钮,拇指点不中。
  const sizes = {
    sm: 'min-h-[40px] px-3.5 text-sm',
    md: 'min-h-[44px] px-4 text-[15px]',
    lg: 'min-h-[50px] px-6 text-base',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
