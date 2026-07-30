import { redirect } from 'next/navigation'

/**
 * 登录后直接落在选题库。原来的总览页(统计卡+事件流)是给"管流水线的人"看的,
 * 而这个系统只有一个用户、动线只有两步:选题 → 已完成里复制发布。
 * 首页就该是第一步。
 */
export default function DashboardIndex() {
  redirect('/dashboard/topics')
}
