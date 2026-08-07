import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { decideApproval } from '@/lib/agents/pipeline'
import { sendTelegramMessage } from '@/lib/providers/telegram'

/**
 * Telegram 审批回调。两种来源:
 * 1. n8n Telegram Trigger 转发(带 x-webhook-secret),body: { callbackData: "approve:<itemId>" }
 * 2. Telegram setWebhook 直连(带 ?token= 查询参数),body 为 Telegram Update 对象
 */
export async function POST(req: NextRequest) {
  const tokenParam = req.nextUrl.searchParams.get('token')
  const viaDirectWebhook = tokenParam && tokenParam === process.env.N8N_WEBHOOK_SECRET
  if (!viaDirectWebhook) {
    const denied = checkWebhookSecret(req)
    if (denied) return denied
  }

  const body = await req.json().catch(() => ({}))
  const callbackData: string | undefined = body.callbackData ?? body.callback_query?.data
  const decidedBy: string | undefined = body.decidedBy ?? body.callback_query?.from?.username

  if (!callbackData) return NextResponse.json({ ok: true, note: '无 callback data,忽略' })
  const [action, itemId] = callbackData.split(':')
  if (!itemId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ ok: false, error: `无法解析 callback: ${callbackData}` }, { status: 400 })
  }

  try {
    const decision = action === 'approve' ? 'approved' : 'rejected'
    await decideApproval(itemId, decision, 'telegram', undefined, decidedBy)
    await sendTelegramMessage(
      decision === 'approved'
        ? `✅ 已批准。请在抖音发布(记得勾选平台的AI生成内容声明),然后回看板登记链接:${process.env.FACTORY_APP_URL || ''}/dashboard/published`
        : `❌ 已拒绝,该条内容停在 rejected 状态,可在看板中查看原因或重新生产。`
    )
    return NextResponse.json({ ok: true, itemId, decision })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
