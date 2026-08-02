import { NextRequest, NextResponse } from 'next/server'
import { customTopic } from '@/lib/agents/custom-topic'

export const dynamic = 'force-dynamic'
// 深度检索(最多 8 次搜索)+ 抓来源正文,顶着函数上限给满
export const maxDuration = 60

/** 自定义题材:老板描述想发什么 → 检索建题并入队。登录门禁在 middleware。 */
export async function POST(req: NextRequest) {
  let description = ''
  try {
    const body = (await req.json()) as { description?: string }
    description = String(body.description ?? '').trim()
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
    const result = await customTopic(description)
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
