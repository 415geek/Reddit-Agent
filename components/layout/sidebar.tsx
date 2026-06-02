'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, TrendingUp, Users, MapPin, AlertCircle, FileText, LogOut } from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: BarChart3, label: 'Overview' },
  { href: '/dashboard/leads', icon: TrendingUp, label: 'High Intent Leads' },
  { href: '/dashboard/cities', icon: MapPin, label: 'City Ranking' },
  { href: '/dashboard/competitors', icon: AlertCircle, label: 'Competitor Pain Map' },
  { href: '/dashboard/pain-points', icon: FileText, label: 'Pain Points' },
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
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">MarketVoice</div>
            <div className="text-xs text-gray-400">POS Intelligence</div>
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
              pathname === href ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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
          Logout
        </button>
      </div>
    </aside>
  )
}
