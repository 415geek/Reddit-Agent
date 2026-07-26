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

export interface MotionOpts {
  itemId: string
  name: string
  durationSec: number
}

export interface MotionGenProvider {
  /**
   * 图生视频(Seedance):关键动态镜头。
   * 传入的是上一步出图的完整结果——云端模型需要 meta.sourceUrl(公网地址),
   * 本地/自托管实现则用 path。
   */
  generateMotion(image: GeneratedFile, motionPrompt: string, opts: MotionOpts): Promise<GeneratedFile>

  /**
   * 异步两段式(serverless 必需):单段图生视频要 60-90 秒,比函数上限还长,
   * 同步等一定超时。实现了这对方法的 provider 会被拆成"提交"和"取结果"两次调用,
   * 任务 id 存库,跨请求轮询。没实现的(mock/自托管)继续走上面的同步路径。
   */
  startMotion?(image: GeneratedFile, motionPrompt: string, opts: MotionOpts): Promise<{ jobId: string }>
  /** 未完成返回 null,完成返回落盘结果 */
  pollMotion?(jobId: string, opts: MotionOpts): Promise<GeneratedFile | null>
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
