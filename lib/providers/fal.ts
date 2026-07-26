import { saveAsset } from '../storage'
import type { GeneratedFile, ImageGenProvider, MotionGenProvider, TTSProvider } from './types'

/**
 * fal.ai 接入:Seedream 文生图 / Seedance 图生视频 / MiniMax 中文TTS。
 * 一个 FAL_KEY 打通三件事,不用分别开通火山方舟并做签名。
 *
 * 需要 env:FAL_KEY(形如 "<id>:<secret>")
 * 可选覆盖模型:FAL_IMAGE_MODEL / FAL_MOTION_MODEL / FAL_TTS_MODEL / FAL_TTS_VOICE
 */

const SYNC_BASE = 'https://fal.run'
const QUEUE_BASE = 'https://queue.fal.run'

const IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || 'fal-ai/bytedance/seedream/v4/text-to-image'
const MOTION_MODEL = process.env.FAL_MOTION_MODEL || 'fal-ai/bytedance/seedance/v1/pro/image-to-video'
const TTS_MODEL = process.env.FAL_TTS_MODEL || 'fal-ai/minimax/speech-02-hd'
const TTS_VOICE = process.env.FAL_TTS_VOICE || 'Wise_Woman'

function falKey() {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('缺少 FAL_KEY(MEDIA_PROVIDER=fal 时必填)')
  return key
}

function headers() {
  return { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' }
}

/** 同步调用:适合秒级返回的模型(出图、TTS) */
async function falRun<T>(model: string, body: unknown): Promise<T> {
  const res = await fetch(`${SYNC_BASE}/${model}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`fal ${model} 失败 ${res.status}: ${text.slice(0, 400)}`)
  return JSON.parse(text) as T
}

/**
 * 队列调用:适合分钟级的模型(图生视频)。
 * 提交后轮询 status,完成再取 response。
 */
async function falQueue<T>(model: string, body: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const submit = await fetch(`${QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const submitText = await submit.text()
  if (!submit.ok) throw new Error(`fal ${model} 提交失败 ${submit.status}: ${submitText.slice(0, 400)}`)
  const { request_id, status_url, response_url } = JSON.parse(submitText) as {
    request_id: string
    status_url?: string
    response_url?: string
  }
  const statusUrl = status_url || `${QUEUE_BASE}/${model}/requests/${request_id}/status`
  const responseUrl = response_url || `${QUEUE_BASE}/${model}/requests/${request_id}`

  const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60 * 1000)
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000))
    const st = await fetch(statusUrl, { headers: headers() })
    if (!st.ok) continue
    const { status } = (await st.json()) as { status: string }
    if (status === 'COMPLETED') {
      const out = await fetch(responseUrl, { headers: headers() })
      const outText = await out.text()
      if (!out.ok) throw new Error(`fal ${model} 取结果失败 ${out.status}: ${outText.slice(0, 400)}`)
      return JSON.parse(outText) as T
    }
    if (status !== 'IN_QUEUE' && status !== 'IN_PROGRESS') {
      throw new Error(`fal ${model} 任务状态异常: ${status}`)
    }
  }
  throw new Error(`fal ${model} 轮询超时(request_id=${request_id})`)
}

async function download(url: string, relPath: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`)
  await saveAsset(relPath, Buffer.from(await res.arrayBuffer()))
  return relPath
}

export const falImage: ImageGenProvider = {
  async generateImage(prompt, opts): Promise<GeneratedFile> {
    const width = opts.width ?? 1080
    const height = opts.height ?? 1920
    const out = await falRun<{ images: Array<{ url: string; width: number; height: number }> }>(IMAGE_MODEL, {
      prompt,
      image_size: { width, height },
      num_images: 1,
      enable_safety_checker: true,
    })
    const img = out.images?.[0]
    if (!img?.url) throw new Error('fal 出图返回为空')
    const rel = `items/${opts.itemId}/${opts.name}.png`
    await download(img.url, rel)
    return {
      path: rel,
      // sourceUrl 留给图生视频直接用(fal 托管的公网地址,免去再上传一次)
      meta: { prompt: prompt.slice(0, 500), model: IMAGE_MODEL, sourceUrl: img.url, width: img.width, height: img.height },
      isMock: false,
    }
  },
}

function motionBody(imageUrl: string, motionPrompt: string, durationSec: number) {
  return {
    prompt: motionPrompt,
    image_url: imageUrl,
    aspect_ratio: '9:16',
    resolution: '1080p',
    // duration 只接受 2-12 秒的整数
    duration: String(Math.max(2, Math.min(12, Math.round(durationSec)))),
  }
}

export const falMotion: MotionGenProvider = {
  /** 同步版:自托管/长超时环境用 */
  async generateMotion(image, motionPrompt, opts): Promise<GeneratedFile> {
    const imageUrl = image.meta?.sourceUrl as string | undefined
    if (!imageUrl) throw new Error('缺少图片公网地址(sourceUrl),无法做图生视频')
    const out = await falQueue<{ video: { url: string } }>(MOTION_MODEL, motionBody(imageUrl, motionPrompt, opts.durationSec))
    if (!out.video?.url) throw new Error('fal 图生视频返回为空')
    const rel = `items/${opts.itemId}/${opts.name}.mp4`
    await download(out.video.url, rel)
    return { path: rel, meta: { motionPrompt: motionPrompt.slice(0, 500), model: MOTION_MODEL, sourceImage: image.path }, isMock: false }
  },

  /** 只提交,不等待——serverless 下必须这样,否则单段就超时 */
  async startMotion(image, motionPrompt, opts) {
    const imageUrl = image.meta?.sourceUrl as string | undefined
    if (!imageUrl) throw new Error('缺少图片公网地址(sourceUrl),无法做图生视频')
    const res = await fetch(`${QUEUE_BASE}/${MOTION_MODEL}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(motionBody(imageUrl, motionPrompt, opts.durationSec)),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`fal 图生视频提交失败 ${res.status}: ${text.slice(0, 400)}`)
    const { request_id } = JSON.parse(text) as { request_id: string }
    if (!request_id) throw new Error('fal 未返回 request_id')
    return { jobId: request_id }
  },

  /** 查一次状态:没好返回 null,好了就下载落盘 */
  async pollMotion(jobId, opts) {
    // fal 的队列路径用的是模型的 owner 前缀(如 fal-ai/bytedance),不是完整模型路径
    const owner = MOTION_MODEL.split('/').slice(0, 2).join('/')
    const st = await fetch(`${QUEUE_BASE}/${owner}/requests/${jobId}/status`, { headers: headers() })
    if (!st.ok) throw new Error(`fal 查状态失败 ${st.status}: ${(await st.text()).slice(0, 300)}`)
    const { status } = (await st.json()) as { status: string }
    if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') return null
    if (status !== 'COMPLETED') throw new Error(`fal 图生视频任务异常: ${status}`)

    const out = await fetch(`${QUEUE_BASE}/${owner}/requests/${jobId}`, { headers: headers() })
    const outText = await out.text()
    if (!out.ok) throw new Error(`fal 取结果失败 ${out.status}: ${outText.slice(0, 300)}`)
    const { video } = JSON.parse(outText) as { video?: { url: string } }
    if (!video?.url) throw new Error('fal 图生视频返回为空')
    const rel = `items/${opts.itemId}/${opts.name}.mp4`
    await download(video.url, rel)
    return { path: rel, meta: { model: MOTION_MODEL, jobId }, isMock: false }
  },
}

export const falTts: TTSProvider = {
  async synthesize(text, opts): Promise<GeneratedFile> {
    const out = await falRun<{ audio: { url: string }; duration_ms?: number }>(TTS_MODEL, {
      text,
      voice_setting: { voice_id: opts.voice || TTS_VOICE, speed: 1, vol: 1 },
      language_boost: 'Chinese',
      output_format: 'url',
    })
    if (!out.audio?.url) throw new Error('fal TTS 返回为空')
    const rel = `items/${opts.itemId}/${opts.name}.mp3`
    await download(out.audio.url, rel)
    return {
      path: rel,
      meta: { chars: text.length, model: TTS_MODEL, voice: opts.voice || TTS_VOICE, durationMs: out.duration_ms },
      isMock: false,
    }
  },
}
