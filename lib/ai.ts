import Anthropic from '@anthropic-ai/sdk'
import { getMockFixture } from './mock/fixtures'
import { parseLoose } from './json-repair'

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

/** 最近一次调用的 token 用量。单实例内串行调用,读完即取走 */
export interface AiUsage {
  inputTokens: number
  outputTokens: number
}
let _lastUsage: AiUsage = { inputTokens: 0, outputTokens: 0 }
export function takeLastUsage(): AiUsage {
  const u = _lastUsage
  _lastUsage = { inputTokens: 0, outputTokens: 0 }
  return u
}

/**
 * 只重试"瞬时"失败:529 过载 / 429 限流。它们失败在毫秒级、重试大概率就好;
 * 其他错误(400/401/内容问题)重试没有意义。上限两次,间隔给足——
 * Anthropic 过载时连着敲只会继续 529。
 */
async function callOnce(system: string, user: string, maxTokens: number, attempt = 0): Promise<string> {
  try {
    return await callOnceInner(system, user, maxTokens)
  } catch (e) {
    const msg = String(e)
    if (attempt < 2 && /529|overloaded|429|rate.?limit/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
      return callOnce(system, user, maxTokens, attempt + 1)
    }
    throw e
  }
}

async function callOnceInner(system: string, user: string, maxTokens: number): Promise<string> {
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
  _lastUsage = {
    inputTokens: (res.usage?.input_tokens ?? 0) + _lastUsage.inputTokens,
    outputTokens: (res.usage?.output_tokens ?? 0) + _lastUsage.outputTokens,
  }
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
  const text = await callOnce(opts.system, opts.user, maxTokens)

  const first = parseLoose<T>(stripFences(text))
  if ('value' in first) return first.value

  // 把真实报错喂回去。之前这里写的是"报错内容已省略",模型不知道哪儿错了,
  // 重试基本是原样再来一遍——实测同一条内容连挂两次。
  const retry = await callOnce(
    opts.system,
    `${opts.user}\n\n你上一次的输出不是合法JSON,解析报错:${first.error}\n` +
      `最常见的原因是字符串值里出现了没转义的半角双引号(比如标题里的"9.99定价")。` +
      `中文引号请一律用「」,不要用半角 " 。\n` +
      `请重新输出,只输出一个合法JSON,不要任何解释文字、不要markdown围栏。上次输出:\n${text.slice(0, 2000)}`,
    maxTokens,
  )
  const second = parseLoose<T>(stripFences(retry))
  if ('value' in second) return second.value
  throw new Error(`AI 输出两次都不是合法JSON:${second.error}`)
}

/**
 * 带联网搜索的 JSON 生成。给"补题"用:模型自己去搜,再把搜到的整理成选题。
 *
 * 和 generateJSON 分开写,因为形状完全不同:
 * 返回的 content 里混着 server_tool_use / web_search_tool_result / text 三种块,
 * JSON 在最后的 text 块里;搜索本身要花 20-40 秒,serverless 60 秒上限内
 * 只够跑一次,所以不做解析失败重试——parseLoose 的修复能力就是兜底。
 */
export async function generateJSONWithSearch<T>(opts: {
  system: string
  user: string
  maxTokens?: number
  maxSearches?: number
  mockKey: string
  mockParams?: Record<string, unknown>
}): Promise<T> {
  if (aiMockEnabled()) {
    return getMockFixture(opts.mockKey, opts.mockParams) as T
  }
  const res = await client().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    thinking: { type: 'disabled' },
    // SDK 0.39 的类型表里还没有 server tool,运行时是认的——API 按 JSON 收
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: opts.maxSearches ?? 6 }] as never,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  })
  // 引用会把 text 切成好几块,拼回来再找 JSON
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('')
  const parsed = parseLoose<T>(stripFences(text.slice(text.indexOf('['))))
  if ('value' in parsed) return parsed.value
  const parsed2 = parseLoose<T>(stripFences(text))
  if ('value' in parsed2) return parsed2.value
  throw new Error(`联网选题输出不是合法JSON:${parsed.error};原文开头:${text.slice(0, 200)}`)
}

