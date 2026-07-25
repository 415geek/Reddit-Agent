import { mockCompose, mockImage, mockMotion, mockPublisher, mockTts } from './mock'
import { doubaoTts, douyinPublisher, seedanceMotion, seedreamImage, volcCompose } from './volcengine'
import type { MediaProviders } from './types'

export function getMediaProviders(): MediaProviders {
  const provider = process.env.MEDIA_PROVIDER || 'mock'
  if (provider === 'volcengine') {
    return { image: seedreamImage, motion: seedanceMotion, tts: doubaoTts, compose: volcCompose, publisher: douyinPublisher }
  }
  return { image: mockImage, motion: mockMotion, tts: mockTts, compose: mockCompose, publisher: mockPublisher }
}
