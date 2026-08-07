import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { completeComposeJob, failComposeJob } from '@/lib/agents/compose-queue'

export const maxDuration = 60

/**
 * 合成 worker 交货。
 * body: { path, meta }        —— 成片已由 worker 直传存储(Supabase/本地卷),这里只登记
 *       { error: "..." }      —— 合成失败,释放认领让任务回池
 *
 * 成片文件本身不走这个接口上传:serverless 的请求体上限只有几 MB,
 * 一条竖屏成片轻松几十 MB,必须由 worker 直传存储。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  try {
    const body = (await req.json()) as { path?: string; meta?: Record<string, unknown>; error?: string }
    if (body.error) {
      await failComposeJob(params.id, body.error)
      return NextResponse.json({ ok: true, released: true })
    }
    if (!body.path) return NextResponse.json({ ok: false, error: '缺少 path' }, { status: 400 })
    const result = await completeComposeJob(params.id, body.path, body.meta ?? {})
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, itemId: params.id, error: String(e) }, { status: 500 })
  }
}
