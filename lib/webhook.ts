import { NextRequest, NextResponse } from 'next/server'

/**
 * 流水线接口的门禁。两把钥匙,谁来开门用谁的:
 *
 * 1. x-webhook-secret 头 = N8N_WEBHOOK_SECRET —— n8n、脚本、手动 curl 用
 * 2. Authorization: Bearer CRON_SECRET —— Vercel Cron 用。
 *    Cron 不会带自定义头,但项目里设了 CRON_SECRET 环境变量后,
 *    Vercel 会自动给每次 cron 调用挂上这个 Bearer。
 *    没有这一条的时候,vercel.json 里那个每小时的 tick 一直在敲 401——
 *    生产上的"自动推进"其实从来没自动过,全靠有人在看板上点。
 *
 * middleware 对 /api/pipeline、/api/hooks 放行,门禁在这里。
 */
export function checkWebhookSecret(req: NextRequest): NextResponse | null {
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.N8N_WEBHOOK_SECRET && secret === process.env.N8N_WEBHOOK_SECRET) return null

  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
