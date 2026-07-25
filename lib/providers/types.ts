// 外部媒体能力的统一接口。MEDIA_PROVIDER=mock|volcengine 决定实现。

export interface GeneratedFile {
  path: string // 相对 DATA_DIR 的路径
  meta: Record<string, unknown>
  isMock: boolean
}

export interface ImageGenProvider {
  /** 文生图(Seedream):竖屏9:16分镜图/封面背景 */
  generateImage(prompt: string, opts: { itemId: string; name: string; width?: number; height?: number }): Promise<GeneratedFile>
}

export interface MotionGenProvider {
  /** 图生视频(Seedance):关键动态镜头 */
  generateMotion(imagePath: string, motionPrompt: string, opts: { itemId: string; name: string; durationSec: number }): Promise<GeneratedFile>
}

export interface TTSProvider {
  /** 配音(豆包语音) */
  synthesize(text: string, opts: { itemId: string; name: string; voice?: string }): Promise<GeneratedFile>
}

export interface ComposeProvider {
  /** 视频合成(Remotion/FFmpeg worker,Phase 2) */
  compose(opts: { itemId: string; shots: unknown[]; voiceoverPath: string; coverPath?: string }): Promise<GeneratedFile>
}

export interface PublisherProvider {
  /** 抖音开放平台发布(Phase 3,当前为 stub) */
  publish(opts: { itemId: string; videoPath: string; title: string; declareAigc: boolean }): Promise<{ externalId: string; shareUrl: string }>
}

export interface MediaProviders {
  image: ImageGenProvider
  motion: MotionGenProvider
  tts: TTSProvider
  compose: ComposeProvider
  publisher: PublisherProvider
}
