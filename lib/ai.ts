import Anthropic from '@anthropic-ai/sdk'
import { getMockFixture } from './mock/fixtures'

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

let _client: Anthropic | null = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export function aiMockEnabled() {
  return process.env.AI_MOCK === '1'
}

function stripFences(text: string) {
  return text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim()
}

async function callOnce(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await client().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    // claude-sonnet-5 起移除了 temperature/top_p/top_k(传了直接 400),用提示词控制风格
    // thinking 与正文共用 max_tokens;serverless 有 60 秒函数上限,长 JSON 容易被思考挤掉,
    // 故这里关闭思考换取稳定与速度。自托管(无 60s 限制)可改成 { type: 'adaptive' } 提升质量。
    thinking: { type: 'disabled' },
    system,
    messages: [{ role: 'user', content: user }],
  })
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('AI 返回中没有文本内容')
  return block.text
}

/**
 * 调用 Claude 并解析为 JSON。AI_MOCK=1 时返回 fixture(mockKey 必填)。
 * 解析失败自动重试一次,把错误反馈给模型。
 */
export async function generateJSON<T>(opts: {
  system: string
  user: string
  maxTokens?: number
  mockKey: string
  mockParams?: Record<string, unknown>
}): Promise<T> {
  if (aiMockEnabled()) {
    return getMockFixture(opts.mockKey, opts.mockParams) as T
  }
  const maxTokens = opts.maxTokens ?? 4096
  let text = await callOnce(opts.system, opts.user, maxTokens)
  try {
    return JSON.parse(stripFences(text)) as T
  } catch {
    text = await callOnce(
      opts.system,
      `${opts.user}\n\n你上一次的输出不是合法JSON,报错内容已省略。请重新输出,只输出一个合法JSON,不要任何解释文字、不要markdown围栏。上次输出:\n${text.slice(0, 2000)}`,
      maxTokens
    )
    return JSON.parse(stripFences(text)) as T
  }
}
