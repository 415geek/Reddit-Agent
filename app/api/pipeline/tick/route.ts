import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { runPipelineTick } from '@/lib/agents/tick'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * 流水线心跳。反复敲这一下,在产内容就会自己从研究一路走到待审批。
 *
 * 谁来敲:自托管 worker(推荐,它同时还要做合成)、Vercel Cron、n8n,都行。
 * 一次只做够预算的活——这个接口跑在 serverless 上有函数时长上限,
 * 它本来就是设计成被反复调用的。
 */
export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied

  if (process.env.AUTO_PIPELINE === 'off') {
    return NextResponse.json({ ok: true, paused: true, note: 'AUTO_PIPELINE=off,自动生产已停用' })
  }

  const body = (await req.json().catch(() => ({}))) as { budgetMs?: number }
  try {
    const result = await runPipelineTick({ budgetMs: body.budgetMs })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

/** GET 同义,方便 Vercel Cron 直接命中 */
export async function GET(req: NextRequest) {
  return POST(req)
}
