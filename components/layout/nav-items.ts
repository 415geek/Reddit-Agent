import { CheckCircle2, Factory, LayoutDashboard, LineChart, Lightbulb, Newspaper, Send, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  /** 底部标签栏用的短标签:手机上一格只有 ~70px,四个字必然折行 */
  short: string
  /** 是否进底部标签栏。iOS 的标签栏超过 5 个就该收进"更多" */
  tab?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: '总览', short: '总览', tab: true },
  { href: '/dashboard/sources', icon: Newspaper, label: '素材库', short: '素材' },
  { href: '/dashboard/topics', icon: Lightbulb, label: '选题库', short: '选题', tab: true },
  { href: '/dashboard/production', icon: Factory, label: '生产中', short: '生产', tab: true },
  { href: '/dashboard/approvals', icon: CheckCircle2, label: '审批队列', short: '审批', tab: true },
  { href: '/dashboard/published', icon: Send, label: '已发布·数据', short: '已发布' },
  { href: '/dashboard/insights', icon: LineChart, label: '复盘', short: '复盘' },
  { href: '/dashboard/settings', icon: Settings, label: '设置', short: '设置' },
]

export const TAB_ITEMS = NAV_ITEMS.filter((i) => i.tab)
export const MORE_ITEMS = NAV_ITEMS.filter((i) => !i.tab)

/** 当前路由对应哪个导航项。/dashboard 是前缀,要精确匹配才不会一直高亮 */
export function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}
