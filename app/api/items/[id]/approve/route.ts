import { NextRequest, NextResponse } from 'next/server'
import { decideApproval } from '@/lib/agents/pipeline'

/** 网页审批 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const decision = body.decision === 'rejected' ? 'rejected' : 'approved'
  try {
    const result = await decideApproval(params.id, decision, 'web', body.notes, 'admin')
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 })
  }
}
