'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Brain, LayoutDashboard, Lightbulb, Factory, CheckCircle2, Send, LineChart, Settings, LogOut } from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '总览' },
  { href: '/dashboard/topics', icon: Lightbulb, label: '选题库' },
  { href: '/dashboard/production', icon: Factory, label: '生产中' },
  { href: '/dashboard/approvals', icon: CheckCircle2, label: '审批队列' },
  { href: '/dashboard/published', icon: Send, label: '已发布·数据' },
  { href: '/dashboard/insights', icon: LineChart, label: '复盘' },
  { href: '/dashboard/settings', icon: Settings, label: '设置' },
]

export function Sidebar() {
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-900 text-white flex flex-col h-screen sticky top-0">
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
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
