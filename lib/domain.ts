// 领域类型与常量:阶段机、分类、封面模板、评分维度

// 质检紧跟脚本、在分镜之前:不合规的脚本要在花钱生成图片/配音之前就被拦下并返工
export const STAGES = [
  'research',
  'script',
  'qc',
  'storyboard',
  'assets',
  'voiceover',
  'compose',
  'awaiting_approval',
] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABELS: Record<string, string> = {
  research: '资料研究',
  script: '脚本',
  storyboard: '分镜',
  assets: '图片资产',
  voiceover: '配音',
  compose: '合成',
  qc: '质检',
  awaiting_approval: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  published: '已发布',
}

export const CATEGORY_LABELS: Record<string, string> = {
  behavioral_econ: '行为经济学',
  marketing_psych: '消费营销心理',
  ai_money: 'AI时代赚钱逻辑',
  business_case: '餐饮小生意案例',
}

export const REGION_LABELS: Record<string, string> = {
  north_america: '北美',
  china: '国内',
  global: '通用',
}

export const TOPIC_STATUS_LABELS: Record<string, string> = {
  idea: '选题池',
  scored: '已评分',
  rejected: '已淘汰',
  queued: '已入队',
  in_production: '制作中',
  produced: '已产出',
  published: '已发布',
  retired: '已停产',
}

export const COVER_TEMPLATES = ['truth', 'counter', 'control'] as const
export type CoverTemplate = (typeof COVER_TEMPLATES)[number]
export const COVER_TEMPLATE_LABELS: Record<string, string> = {
  truth: '真相型',
  counter: '反常识型',
  control: '控制型',
}

/**
 * 背景音乐情绪。知识类账号的BGM只有一个职责:垫住旁白、制造节奏,
 * 不能抢话——所以四种都是器乐、无人声、动态范围小的"底噪型"音乐。
 */
export const BGM_MOODS = ['suspense', 'momentum', 'insight', 'warm'] as const
export type BgmMood = (typeof BGM_MOODS)[number]
export const BGM_MOOD_LABELS: Record<BgmMood, string> = {
  suspense: '悬念揭秘',
  momentum: '推进紧凑',
  insight: '理性洞察',
  warm: '生活温和',
}

/** 生成/挑选BGM用的音乐描述词。统一强调 instrumental、no vocals、低起伏 */
export const BGM_MOOD_PROMPTS: Record<BgmMood, string> = {
  suspense:
    'dark minimal cinematic underscore, sparse low piano notes, sustained bass drone, subtle ticking pulse, restrained tension, no vocals, no drum buildup, no big climax, steady low dynamics, background bed for spoken narration, instrumental',
  momentum:
    'modern minimal electronic underscore, steady muted pulse, light arpeggiated synth, forward driving but understated, no vocals, no drop, no aggressive percussion, even dynamics, background bed for spoken narration, instrumental',
  insight:
    'calm analytical ambient underscore, clean sustained pads, occasional soft marimba or bell, spacious and neutral, no vocals, no melody hook, very even dynamics, background bed for spoken narration, instrumental',
  warm: 'warm acoustic underscore, soft nylon guitar and light rhodes, gentle everyday optimism, unhurried, no vocals, no strong beat, even dynamics, background bed for spoken narration, instrumental',
}

/** 分镜没给情绪时的兜底:按封面模板推。三种模板本来就对应三种叙事张力 */
const COVER_TEMPLATE_BGM: Record<CoverTemplate, BgmMood> = {
  truth: 'suspense',
  counter: 'momentum',
  control: 'insight',
}

/**
 * 决定这条内容用哪种BGM。优先用分镜模型给的,给错或没给就按选题推:
 * 餐饮小生意讲的是身边人的日子,配悬疑乐会很怪,所以按品类先兜一层。
 */
export function pickBgmMood(input: { bgmMood?: string | null; coverTemplate: string; category?: string | null }): BgmMood {
  if (input.bgmMood && (BGM_MOODS as readonly string[]).includes(input.bgmMood)) return input.bgmMood as BgmMood
  if (input.category === 'business_case') return 'warm'
  return COVER_TEMPLATE_BGM[input.coverTemplate as CoverTemplate] ?? 'insight'
}

// 选题评分维度与权重(用户蓝图)
export const SCORE_WEIGHTS = {
  conflict: 0.25, // 点击冲突
  relevance: 0.2, // 普通人相关性
  emotion: 0.15, // 情绪张力
  freshness: 0.15, // 新鲜程度
  story: 0.1, // 能否讲出故事
  credibility: 0.1, // 信息可信度
  conversion: 0.05, // 商业转化价值
} as const
export type ScoreDims = Record<keyof typeof SCORE_WEIGHTS, number>

export const SCORE_QUEUE_THRESHOLD = 70 // 总分(0-100)达标才有资格入队

// 风险淘汰清单(命中即 rejected)
export const RISK_FLAGS = [
  'stock_prediction', // 个股预测
  'fund_recommendation', // 基金推荐
  'guaranteed_return', // 保证收益
  'fabricated_expert', // 虚构专家观点
  'unsourced_macro_data', // 没有来源的宏观数据
  'rumor_as_fact', // 将传闻包装成事实
] as const

export interface SupportingFact {
  claim: string
  source: string
  confidence: number
}

export interface ResearchOutput {
  core_claim: string
  supporting_facts: SupportingFact[]
  counterarguments: string[]
  risk_notes: string[]
  usable_examples: string[]
}

export interface ScriptBeats {
  hook: string // 0-3秒 反常识钩子
  scene: string // 3-15秒 熟悉场景
  principle: string // 15-50秒 解释原理
  caseStudy: string // 50-75秒 真实案例
  twist: string // 75-90秒 反转与行动
  interaction: string // 结尾互动问题
}

export interface Shot {
  idx: number
  type: 'image' | 'motion'
  imagePrompt: string
  motionPrompt?: string
  durationSec: number
  cameraMove: string // push_in | pan | depth | particles | glow
  narration: string
}

export interface QcReport {
  passed: boolean
  typos: string[]
  complianceIssues: string[]
  durationOk: boolean
  notes: string
}

export interface TopicCandidate {
  title: string
  hook: string
  category: string
  region: string
}

export interface TopicScore {
  title: string
  scores: ScoreDims
  total: number
  riskFlags: string[]
}
