import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { runRetrospective } from '@/lib/agents/retrospective'
import { sendTelegramMessage } from '@/lib/providers/telegram'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  try {
    const result = await runRetrospective(Number(body.periodDays) || 7)
    await sendTelegramMessage(`🧠 *每周复盘*\n${result.summary}\n新增续集选题:${result.sequels} 个`)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
