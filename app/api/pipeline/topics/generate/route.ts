import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { generateAndScoreTopics } from '@/lib/agents/topics'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const count = Math.min(Number(body.count) || 30, 60)
  try {
    const result = await generateAndScoreTopics(count)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
