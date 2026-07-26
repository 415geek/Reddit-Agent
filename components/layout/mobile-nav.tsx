'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Brain, LogOut, MoreHorizontal, X } from 'lucide-react'
import { MORE_ITEMS, NAV_ITEMS, TAB_ITEMS, isActive } from './nav-items'
import { logout } from './logout'

/**
 * 手机端导航。用底部标签栏而不是汉堡菜单:
 * 6.3 寸的屏幕单手握持时,拇指够得到的是下缘那一条,右上角的汉堡按钮要换手。
 * 七个页面塞不进标签栏(iOS 的惯例是最多 5 格),常用的四个直接放,其余收进"更多"。
 */
export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const current = NAV_ITEMS.find((i) => isActive(pathname, i.href))
  const moreActive = MORE_ITEMS.some((i) => isActive(pathname, i.href))

  // 换页面就把面板收起来,否则返回后它还开着
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  // 面板打开时锁住背景滚动,不然 iOS 上会滚穿到下面的列表
  useEffect(() => {
    document.body.style.overflow = moreOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [moreOpen])

  return (
    <>
      {/* 顶栏:贴着灵动岛下沿,只放身份和当前页名 */}
      <header className="lg:hidden sticky top-0 z-30 bg-gray-900 text-white pt-safe">
        <div className="h-14 px-4 flex items-center gap-2.5">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight truncate">生意脑回路</div>
            <div className="text-[11px] text-gray-400 leading-tight truncate">{current?.label ?? 'AI 内容工厂'}</div>
          </div>
        </div>
      </header>

      {/* 更多面板 */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            aria-label="关闭"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl pb-safe">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-base font-semibold text-gray-900">更多</span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="关闭"
                className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="px-2 pb-2">
              {MORE_ITEMS.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-4 min-h-[52px] rounded-xl text-[15px] font-medium',
                    isActive(pathname, href) ? 'bg-orange-50 text-orange-700' : 'text-gray-700 active:bg-gray-100',
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {label}
                </Link>
              ))}
              <button
                onClick={logout}
                className="flex items-center gap-3 px-4 min-h-[52px] w-full rounded-xl text-[15px] font-medium text-red-600 active:bg-red-50"
              >
                <LogOut className="w-5 h-5" />
                退出登录
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* 底部标签栏 */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 pb-safe"
        aria-label="主导航"
      >
        <div className="grid grid-cols-5">
          {TAB_ITEMS.map(({ href, icon: Icon, short }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                // min-h 44px 是 iOS 的最小可点区域,图标+文字竖排刚好落在这个高度以上
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-medium',
                  active ? 'text-orange-600' : 'text-gray-500 active:text-gray-900',
                )}
              >
                <Icon className={cn('w-[22px] h-[22px]', active && 'stroke-[2.5]')} />
                {short}
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="更多"
            aria-expanded={moreOpen}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-medium',
              moreActive || moreOpen ? 'text-orange-600' : 'text-gray-500 active:text-gray-900',
            )}
          >
            <MoreHorizontal className="w-[22px] h-[22px]" />
            更多
          </button>
        </div>
      </nav>
    </>
  )
}
