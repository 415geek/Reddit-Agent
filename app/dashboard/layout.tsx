export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex min-h-screen bg-gray-50">
      <Sidebar />
      <MobileNav />
      <main className="flex-1 min-w-0">
        {/* 手机上留出底部标签栏的高度,否则最后一行内容永远被它挡住 */}
        <div className="px-4 py-5 pb-tabbar sm:px-6 lg:p-8 lg:pb-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
