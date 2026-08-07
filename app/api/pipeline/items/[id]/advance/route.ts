import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { advanceItem } from '@/lib/agents/pipeline'

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied
  try {
    const result = await advanceItem(params.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, itemId: params.id, error: String(e) }, { status: 500 })
  }
}
