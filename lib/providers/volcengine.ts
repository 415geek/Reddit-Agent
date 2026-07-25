import { saveAsset } from '../storage'
import type { ComposeProvider, GeneratedFile, ImageGenProvider, MotionGenProvider, PublisherProvider, TTSProvider } from './types'

// 火山引擎(方舟 Ark)实现骨架:Seedream 文生图、Seedance 图生视频、豆包语音 TTS。
// 需要 env:ARK_API_KEY(方舟 API Key)、SEEDREAM_MODEL、SEEDANCE_MODEL、
//           DOUBAO_TTS_APPID、DOUBAO_TTS_TOKEN、DOUBAO_TTS_VOICE
// 文档:https://www.volcengine.com/docs/82379 (方舟) / https://www.volcengine.com/docs/6561 (语音)

const ARK_BASE = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`缺少环境变量 ${name}(MEDIA_PROVIDER=volcengine 时必填,或改用 MEDIA_PROVIDER=mock)`)
  return v
}

export const seedreamImage: ImageGenProvider = {
  async generateImage(prompt, opts): Promise<GeneratedFile> {
    const apiKey = requireEnv('ARK_API_KEY')
    const model = requireEnv('SEEDREAM_MODEL')
    const res = await fetch(`${ARK_BASE}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        prompt,
        size: `${opts.width ?? 1080}x${opts.height ?? 1920}`,
        response_format: 'b64_json',
        watermark: false,
      }),
    })
    if (!res.ok) throw new Error(`Seedream 请求失败 ${res.status}: ${(await res.text()).slice(0, 500)}`)
    const json = (await res.json()) as { data: Array<{ b64_json?: string; url?: string }> }
    const first = json.data?.[0]
    if (!first) throw new Error('Seedream 返回为空')
    let buf: Buffer
    if (first.b64_json) buf = Buffer.from(first.b64_json, 'base64')
    else {
      const imgRes = await fetch(first.url!)
      buf = Buffer.from(await imgRes.arrayBuffer())
    }
    const rel = `items/${opts.itemId}/${opts.name}.png`
    await saveAsset(rel, buf)
    return { path: rel, meta: { prompt: prompt.slice(0, 500), model }, isMock: false }
  },
}

export const seedanceMotion: MotionGenProvider = {
  async generateMotion(imagePath, motionPrompt, opts): Promise<GeneratedFile> {
    const apiKey = requireEnv('ARK_API_KEY')
    const model = requireEnv('SEEDANCE_MODEL')
    // Seedance 为异步任务:创建任务 → 轮询 → 下载
    const createRes = await fetch(`${ARK_BASE}/contents/generations/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        content: [
          { type: 'text', text: `${motionPrompt} --ratio 9:16 --duration ${Math.min(opts.durationSec, 10)}` },
        ],
      }),
    })
    if (!createRes.ok) throw new Error(`Seedance 创建任务失败 ${createRes.status}: ${(await createRes.text()).slice(0, 500)}`)
    const { id: taskId } = (await createRes.json()) as { id: string }

    let videoUrl: string | null = null
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const poll = await fetch(`${ARK_BASE}/contents/generations/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const status = (await poll.json()) as { status: string; content?: { video_url?: string } }
      if (status.status === 'succeeded') {
        videoUrl = status.content?.video_url ?? null
        break
      }
      if (status.status === 'failed') throw new Error(`Seedance 任务失败: ${JSON.stringify(status).slice(0, 500)}`)
    }
    if (!videoUrl) throw new Error('Seedance 任务超时(5分钟)')
    const videoRes = await fetch(videoUrl)
    const rel = `items/${opts.itemId}/${opts.name}.mp4`
    await saveAsset(rel, Buffer.from(await videoRes.arrayBuffer()))
    return { path: rel, meta: { motionPrompt: motionPrompt.slice(0, 500), model, taskId }, isMock: false }
  },
}

export const doubaoTts: TTSProvider = {
  async synthesize(text, opts): Promise<GeneratedFile> {
    const appid = requireEnv('DOUBAO_TTS_APPID')
    const token = requireEnv('DOUBAO_TTS_TOKEN')
    const voice = opts.voice || process.env.DOUBAO_TTS_VOICE || 'zh_male_yuanboxiaoshu_moon_bigtts'
    const res = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer;${token}` },
      body: JSON.stringify({
        app: { appid, token, cluster: process.env.DOUBAO_TTS_CLUSTER || 'volcano_tts' },
        user: { uid: 'bizbrain' },
        audio: { voice_type: voice, encoding: 'mp3', speed_ratio: 1.0 },
        request: { reqid: `${opts.itemId}-${opts.name}-${Date.now()}`, text, operation: 'query' },
      }),
    })
    if (!res.ok) throw new Error(`豆包TTS 请求失败 ${res.status}: ${(await res.text()).slice(0, 500)}`)
    const json = (await res.json()) as { code: number; message: string; data?: string }
    if (json.code !== 3000 || !json.data) throw new Error(`豆包TTS 返回错误: ${json.code} ${json.message}`)
    const rel = `items/${opts.itemId}/${opts.name}.mp3`
    await saveAsset(rel, Buffer.from(json.data, 'base64'))
    return { path: rel, meta: { chars: text.length, voice }, isMock: false }
  },
}

// 视频合成需要独立的 Remotion/FFmpeg worker(Phase 2),Next.js 容器内不做重合成。
export const volcCompose: ComposeProvider = {
  async compose() {
    throw new Error('视频合成需要独立 worker(Remotion/FFmpeg),见 README「Phase 2:接入合成 worker」。当前请使用 MEDIA_PROVIDER=mock 走占位产物。')
  },
}

export const douyinPublisher: PublisherProvider = {
  async publish() {
    // 抖音开放平台需要企业资质申请 + 用户授权(video.create 权限),Phase 3 接入。
    // 注意:代用户发布时每次操作必须让用户明确感知,禁止隐藏式无人值守发布。
    throw new Error('抖音开放平台发布属于 Phase 3,当前请人工发布并在看板登记链接。')
  },
}
