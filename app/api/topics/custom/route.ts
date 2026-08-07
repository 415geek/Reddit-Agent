import { NextRequest, NextResponse } from 'next/server'
import { customTopic } from '@/lib/agents/custom-topic'

export const dynamic = 'force-dynamic'
// 深度检索 + 抓来源正文,实测 30-70 秒不等;付费计划给到 120 秒留足余量
export const maxDuration = 120

/** 自定义题材:老板描述想发什么 → 检索建题并入队。登录门禁在 middleware。 */
export async function POST(req: NextRequest) {
  let description = ''
  let confirmed = false
  let sponsored = false
  try {
    const body = (await req.json()) as { description?: string; confirmed?: boolean; sponsored?: boolean }
    description = String(body.description ?? '').trim()
    confirmed = !!body.confirmed
    sponsored = !!body.sponsored
  } catch {
    /* 落到下面的长度校验 */
  }
  if (description.length < 5) {
    return NextResponse.json({ ok: false, error: '题材描述太短,至少写一句完整的话' }, { status: 400 })
  }
  if (description.length > 1000) {
    return NextResponse.json({ ok: false, error: '题材描述太长,精简到 1000 字以内' }, { status: 400 })
  }
  try {
    const result = await customTopic(description, { confirmed, sponsored })
    // 「编辑有顾虑等确认」不算错误,给 200,前端按 needsConfirm 分支渲染
    const status = result.ok || ('needsConfirm' in result && result.needsConfirm) ? 200 : 422
    return NextResponse.json(result, { status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
