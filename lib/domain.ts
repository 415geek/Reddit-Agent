// 领域类型与常量:阶段机、分类、封面模板、评分维度

export const STAGES = [
  'research',
  'script',
  'storyboard',
  'assets',
  'voiceover',
  'compose',
  'qc',
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
