import { NextResponse } from 'next/server'
import { refillTopics } from '@/lib/agents/refill'

export const dynamic = 'force-dynamic'
// 联网搜索 20-40 秒 + 整理输出,顶着函数上限给满
export const maxDuration = 60

/** 补题:AI 联网搜一圈,把选题池填上新货。登录门禁在 middleware。 */
export async function POST() {
  try {
    const result = await refillTopics(4)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
