import { NextResponse } from 'next/server'
import { refillTopics } from '@/lib/agents/refill'

export const dynamic = 'force-dynamic'
// 联网搜索实测 50-65 秒 + 每条选题抓正文,60 秒上限刚好骑在刀口上:
// 有时被杀、有时做完了但客户端已断,用户看到的都是「网络出错」。
// 付费计划允许更长,给到 120 秒留足余量
export const maxDuration = 120

/** 补题:AI 联网搜一圈,把选题池填上新货。登录门禁在 middleware。 */
export async function POST() {
  try {
    const result = await refillTopics(4)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
