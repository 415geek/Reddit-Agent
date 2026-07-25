import { saveAsset } from '../storage'
import type { ComposeProvider, GeneratedFile, ImageGenProvider, MotionGenProvider, PublisherProvider, TTSProvider } from './types'

// Mock 实现:无任何外部 key 时让全流程跑通。生成占位 SVG/WAV/文本文件。

function placeholderSvg(label: string, w = 1080, h = 1920) {
  const esc = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 60)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#123047"/>
      <stop offset="60%" stop-color="#0a1420"/>
      <stop offset="100%" stop-color="#05080d"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w / 2}" cy="${h * 0.42}" r="220" fill="none" stroke="#22d3ee" stroke-width="6" opacity="0.7"/>
  <circle cx="${w / 2}" cy="${h * 0.42}" r="150" fill="none" stroke="#f97316" stroke-width="4" opacity="0.8"/>
  <text x="${w / 2}" y="${h * 0.85}" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#94a3b8">MOCK · ${esc}</text>
</svg>`
}

/** 44字节的最小合法 WAV 头(0采样,静音占位) */
function silentWav() {
  const buf = Buffer.alloc(44)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(16000, 24)
  buf.writeUInt32LE(32000, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(0, 40)
  return buf
}

export const mockImage: ImageGenProvider = {
  async generateImage(prompt, opts): Promise<GeneratedFile> {
    const rel = `items/${opts.itemId}/${opts.name}.svg`
    await saveAsset(rel, placeholderSvg(opts.name, opts.width ?? 1080, opts.height ?? 1920))
    return { path: rel, meta: { prompt: prompt.slice(0, 500), mock: true }, isMock: true }
  },
}

export const mockMotion: MotionGenProvider = {
  async generateMotion(imagePath, motionPrompt, opts): Promise<GeneratedFile> {
    const rel = `items/${opts.itemId}/${opts.name}.mp4.txt`
    await saveAsset(rel, `MOCK MOTION CLIP\nsource image: ${imagePath}\nduration: ${opts.durationSec}s\nprompt: ${motionPrompt}`)
    return { path: rel, meta: { motionPrompt: motionPrompt.slice(0, 500), sourceImage: imagePath }, isMock: true }
  },
}

export const mockTts: TTSProvider = {
  async synthesize(text, opts): Promise<GeneratedFile> {
    const rel = `items/${opts.itemId}/${opts.name}.wav`
    await saveAsset(rel, silentWav())
    return { path: rel, meta: { chars: text.length, voice: opts.voice ?? 'mock' }, isMock: true }
  },
}

export const mockCompose: ComposeProvider = {
  async compose(opts): Promise<GeneratedFile> {
    const rel = `items/${opts.itemId}/final.mp4.txt`
    await saveAsset(rel, `MOCK FINAL VIDEO\nshots: ${opts.shots.length}\nvoiceover: ${opts.voiceoverPath}\n合成worker(Remotion/FFmpeg)在 Phase 2 接入,见 README。`)
    return { path: rel, meta: { shotCount: opts.shots.length }, isMock: true }
  },
}

export const mockPublisher: PublisherProvider = {
  async publish() {
    throw new Error('Phase 1 采用人工发布:请在看板"审批队列/已发布"页登记抖音链接。抖音开放平台接入属于 Phase 3。')
  },
}
