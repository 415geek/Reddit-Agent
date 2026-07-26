import { mockCompose, mockImage, mockMotion, mockPublisher, mockTts } from './mock'
import { falImage, falMotion, falTts } from './fal'
import { doubaoTts, douyinPublisher, seedanceMotion, seedreamImage, volcCompose } from './volcengine'
import type { MediaProviders } from './types'

/**
 * MEDIA_PROVIDER:
 *   mock       — 占位产物,零外部依赖(默认)
 *   fal        — fal.ai:Seedream 出图 + Seedance 图生视频 + MiniMax 中文TTS(一个 FAL_KEY 打通)
 *   volcengine — 火山方舟直连 + 豆包语音(需自行开通并配签名参数)
 */
export function getMediaProviders(): MediaProviders {
  switch (process.env.MEDIA_PROVIDER) {
    case 'fal':
      return { image: falImage, motion: falMotion, tts: falTts, compose: mockCompose, publisher: mockPublisher }
    case 'volcengine':
      return { image: seedreamImage, motion: seedanceMotion, tts: doubaoTts, compose: volcCompose, publisher: douyinPublisher }
    default:
      return { image: mockImage, motion: mockMotion, tts: mockTts, compose: mockCompose, publisher: mockPublisher }
  }
}

/** 资产落库时记录真实来源,便于在看板里分辨哪些是占位、哪些是真生成 */
export function providerLabels() {
  switch (process.env.MEDIA_PROVIDER) {
    case 'fal':
      return { image: 'seedream', motion: 'seedance', tts: 'minimax' }
    case 'volcengine':
      return { image: 'seedream', motion: 'seedance', tts: 'doubao' }
    default:
      return { image: 'mock', motion: 'mock', tts: 'mock' }
  }
}
