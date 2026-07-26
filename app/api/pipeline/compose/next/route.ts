import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { claimComposeJob } from '@/lib/agents/compose-queue'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** 合成 worker 领任务:没活干返回 {ok:true, job:null} */
export async function GET(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  const workerId = req.nextUrl.searchParams.get('worker') || 'unknown'
  try {
    const job = await claimComposeJob(workerId)
    return NextResponse.json({ ok: true, job })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
