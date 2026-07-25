import { NextRequest, NextResponse } from 'next/server'

/** n8n 回调门禁:x-webhook-secret 头必须匹配。middleware 对 /api/pipeline、/api/hooks 放行,门禁在这里。 */
export function checkWebhookSecret(req: NextRequest): NextResponse | null {
  const secret = req.headers.get('x-webhook-secret')
  if (!process.env.N8N_WEBHOOK_SECRET || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
