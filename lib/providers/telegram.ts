// Telegram 审批通知:发送审批卡片(inline 按钮),回调由 n8n 或 /api/hooks/telegram 处理

const API = 'https://api.telegram.org'

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  return token && chatId ? { token, chatId } : null
}

export async function sendTelegramMessage(text: string) {
  const c = creds()
  if (!c) return { skipped: true as const }
  const res = await fetch(`${API}/bot${c.token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: c.chatId, text, parse_mode: 'Markdown' }),
  })
  return { skipped: false as const, ok: res.ok }
}

export async function sendApprovalCard(opts: {
  itemId: string
  title: string
  hook: string
  durationSec: number
  coverLines: string[]
  appUrl: string
}) {
  const c = creds()
  if (!c) return { skipped: true as const }
  const text = [
    `🎬 *待审批* ${opts.title}`,
    ``,
    `钩子:${opts.hook}`,
    `时长:约${opts.durationSec}秒`,
    `封面:${opts.coverLines.join(' / ')}`,
    ``,
    `[在看板中预览](${opts.appUrl}/dashboard/approvals)`,
  ].join('\n')
  const res = await fetch(`${API}/bot${c.token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: c.chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 批准', callback_data: `approve:${opts.itemId}` },
            { text: '❌ 拒绝', callback_data: `reject:${opts.itemId}` },
          ],
        ],
      },
    }),
  })
  return { skipped: false as const, ok: res.ok }
}
