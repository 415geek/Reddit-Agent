import { CheckCircle2, Lightbulb, Newspaper, Send, Settings, type LucideIcon } from 'lucide-react'

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
  { href: '/dashboard/topics', icon: Lightbulb, label: '选题库', short: '选题', tab: true },
  { href: '/dashboard/approvals', icon: CheckCircle2, label: '已完成', short: '已完成', tab: true },
  // 下面这些不在主导航里,收进"更多"。页面都还在,直接输网址也能到——
  // 老板的日常动线只有两步:选题库挑题 → 已完成复制发布,其余是偶尔才看的后台
  { href: '/dashboard/sources', icon: Newspaper, label: '素材库', short: '素材' },
  { href: '/dashboard/published', icon: Send, label: '已发布·数据', short: '已发布' },
  { href: '/dashboard/settings', icon: Settings, label: '设置', short: '设置' },
]

export const TAB_ITEMS = NAV_ITEMS.filter((i) => i.tab)
export const MORE_ITEMS = NAV_ITEMS.filter((i) => !i.tab)

/** 当前路由对应哪个导航项。/dashboard 是前缀,要精确匹配才不会一直高亮 */
export function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}
