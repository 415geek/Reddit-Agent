import { NextRequest, NextResponse } from 'next/server'
import { advanceItem } from '@/lib/agents/pipeline'

export const maxDuration = 300

/** 看板手动推进一个阶段(不依赖 n8n 也能生产) */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await advanceItem(params.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, itemId: params.id, error: String(e) }, { status: 500 })
  }
}
