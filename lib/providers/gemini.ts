import { saveAsset } from '../storage'
import type { GeneratedFile, ImageGenProvider } from './types'

/**
 * Gemini 出图。图文这条线的配图全走这里。
 *
 * 选它而不是继续用 fal 的 Seedream,是实测比出来的:
 * 同样的中餐厅场景,Gemini 出的插画和现有小红书号的风格几乎是一路的
 * (暖色线稿、人物表情自然、构图饱满),而且多次生成之间风格稳得住;
 * 写实那一档也能直接当餐饮杂志配图用。Seedance 那边最头疼的
 * "自己往画面里写乱码中文"在这里轻得多。
 */

const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 60_000)

/** 卡片上半部分是横向的,4:3 正好;竖图塞进去会被裁掉大半 */
const ASPECT = process.env.GEMINI_IMAGE_ASPECT || '4:3'

function key() {
  const k = process.env.GEMINI_API_KEY
  if (!k) throw new Error('缺少 GEMINI_API_KEY')
  return k
}

/** 按字节认格式,别信自己起的文件名 */
function extFor(mime: string) {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

async function generate(prompt: string): Promise<{ buf: Buffer; mime: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API}/${MODEL}:generateContent?key=${encodeURIComponent(key())}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ASPECT } },
      }),
      signal: ctrl.signal,
    })
    const json = (await res.json()) as any
    if (!res.ok) {
      throw new Error(`Gemini 出图失败 ${res.status}: ${JSON.stringify(json?.error?.message ?? json).slice(0, 300)}`)
    }
    const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData)
    if (!part) {
      // 触发安全过滤时会返回 candidate 但没有图,把原因带出来,不然排查全靠猜
      const reason = json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason ?? '未知'
      throw new Error(`Gemini 没有返回图片(${reason})`)
    }
    return { buf: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType || 'image/jpeg' }
  } finally {
    clearTimeout(timer)
  }
}

export const geminiImage: ImageGenProvider = {
  async generateImage(prompt, opts): Promise<GeneratedFile> {
    const { buf, mime } = await generate(prompt)
    const path = `items/${opts.itemId}/${opts.name}.${extFor(mime)}`
    await saveAsset(path, buf)
    return {
      path,
      meta: { provider: 'gemini', model: MODEL, aspect: ASPECT, mime, bytes: buf.length, prompt: prompt.slice(0, 500) },
      isMock: false,
    }
  },
}
