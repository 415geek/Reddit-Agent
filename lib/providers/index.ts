import { mockBgm, mockCompose, mockImage, mockMotion, mockPublisher, mockTts } from './mock'
import { falBgm, falImage, falMotion, falTts } from './fal'
import { geminiImage } from './gemini'
import { doubaoTts, douyinPublisher, seedanceMotion, seedreamImage, volcCompose } from './volcengine'
import type { MediaProviders } from './types'

/**
 * MEDIA_PROVIDER:
 *   gemini     — Gemini 出图(图文这条线用这个;实测风格最贴现有小红书号)
 *   mock       — 占位产物,零外部依赖(默认)
 *   fal        — fal.ai:Seedream 出图 + Seedance 图生视频 + MiniMax 中文TTS(一个 FAL_KEY 打通)
 *   volcengine — 火山方舟直连 + 豆包语音(需自行开通并配签名参数)
 */
export function getMediaProviders(): MediaProviders {
  switch (process.env.MEDIA_PROVIDER) {
    case 'gemini':
      // 图文只用到出图。动态/配音/合成是视频那条线的,这里保持占位不调用
      return { image: geminiImage, motion: mockMotion, tts: mockTts, bgm: mockBgm, compose: mockCompose, publisher: mockPublisher }
    case 'fal':
      return { image: falImage, motion: falMotion, tts: falTts, bgm: falBgm, compose: mockCompose, publisher: mockPublisher }
    case 'volcengine':
      return { image: seedreamImage, motion: seedanceMotion, tts: doubaoTts, bgm: falBgm, compose: volcCompose, publisher: douyinPublisher }
    default:
      return { image: mockImage, motion: mockMotion, tts: mockTts, bgm: mockBgm, compose: mockCompose, publisher: mockPublisher }
  }
}

/** 资产落库时记录真实来源,便于在看板里分辨哪些是占位、哪些是真生成 */
export function providerLabels() {
  switch (process.env.MEDIA_PROVIDER) {
    case 'gemini':
      return { image: 'gemini', motion: 'mock', tts: 'mock', bgm: 'mock' }
    case 'fal':
      return { image: 'seedream', motion: 'seedance', tts: 'minimax', bgm: 'cassetteai' }
    case 'volcengine':
      return { image: 'seedream', motion: 'seedance', tts: 'doubao', bgm: 'cassetteai' }
    default:
      return { image: 'mock', motion: 'mock', tts: 'mock', bgm: 'mock' }
  }
}
