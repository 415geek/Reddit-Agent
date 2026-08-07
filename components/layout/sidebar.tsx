'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Brain, LogOut } from 'lucide-react'
import { NAV_ITEMS, isActive } from './nav-items'
import { logout } from './logout'

/** 桌面侧边栏。手机上整块隐藏,导航交给顶栏 + 底部标签栏 */
export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-64 flex-shrink-0 bg-gray-900 text-white flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">生意脑回路</div>
            <div className="text-xs text-gray-400">AI 内容工厂</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(pathname, href) ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
