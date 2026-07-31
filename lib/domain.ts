import BGM_MOODS_CONFIG from '../config/bgm-moods.json'

// 领域类型与常量:阶段机、分类、封面模板、评分维度

/** 产物形态。图文是当前主线,视频那条线代码保留但不再排产 */
export const ITEM_KINDS = ['note', 'video'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]
export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  note: '小红书图文',
  video: '抖音短视频',
}

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

/**
 * 图文的阶段序列。比视频短一半:没有配音和合成,
 * 卡片图是 next/og 在函数里直接出 PNG,不需要外部 worker。
 *
 * note  = 写整条笔记(封面两行标题 + 内页卡片 + 正文 + 话题标签)
 * cards = 出配图 + 把每张卡片渲染成 PNG
 */
/**
 * 序列本身就是制衡链:核实的人不写稿,写稿的人不审自己,审稿的人不改稿。
 *   research 拉料 → verify 逐条定级(证据核查) → note 写稿(只能用过审的料)
 *   → critic 反方审稿(专职推翻) → qc 合规终审 → cards 出图
 * 程序控制推进,任何一关不过都进不了下一关(失败关闭,不是失败后猜测)。
 */
export const NOTE_STAGES = ['research', 'verify', 'note', 'critic', 'qc', 'cards', 'awaiting_approval'] as const
export type NoteStage = (typeof NOTE_STAGES)[number]

export const STAGES_BY_KIND: Record<ItemKind, readonly string[]> = {
  note: NOTE_STAGES,
  video: STAGES,
}

/** 这条内容的下一个阶段是什么。走到头返回 null */
export function nextStage(kind: string, stage: string): string | null {
  const seq = STAGES_BY_KIND[(kind as ItemKind) in STAGES_BY_KIND ? (kind as ItemKind) : 'note']
  const i = seq.indexOf(stage)
  if (i < 0 || i >= seq.length - 1) return null
  return seq[i + 1]
}

export const STAGE_LABELS: Record<string, string> = {
  research: '资料研究',
  verify: '事实核查',
  note: '写笔记',
  critic: '反方审稿',
  cards: '卡片图',
  script: '脚本',
  storyboard: '分镜',
  assets: '图片资产',
  voiceover: '配音',
  compose: '合成',
  qc: '合规终审',
  awaiting_approval: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  published: '已发布',
}

export const CATEGORY_LABELS: Record<string, string> = {
  // 图文(餐饮运营)——照着现有小红书号的栏目分的
  ops: '餐饮运营',
  pricing: '定价与算账',
  policy: '政策法规',
  consumer: '消费者心理',
  menu: '菜单与转化',
  delivery: '外卖与线上',
  labor: '用人与后厨',
  trend: '行业趋势',
  // 视频(停用但保留)
  behavioral_econ: '行为经济学',
  marketing_psych: '消费营销心理',
  ai_money: 'AI时代赚钱逻辑',
  business_case: '餐饮小生意案例',
}

/** 图文选题的品类。视频那四个不在这里,新选题不会再落到它们上面 */
export const NOTE_CATEGORIES = [
  'ops',
  'pricing',
  'policy',
  'consumer',
  'menu',
  'delivery',
  'labor',
  'trend',
] as const
export type NoteCategory = (typeof NOTE_CATEGORIES)[number]

/** 素材源的类别。决定采信权重,也决定选题时优先看哪一批 */
export const SOURCE_CATEGORIES = ['policy', 'regulation', 'trend', 'report', 'media', 'data'] as const
export const SOURCE_CATEGORY_LABELS: Record<string, string> = {
  policy: '政策',
  regulation: '法规',
  trend: '趋势',
  report: '研究报告',
  media: '行业媒体',
  data: '平台数据',
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
export const BGM_MOOD_LABELS: Record<BgmMood, string> = Object.fromEntries(
  BGM_MOODS.map((m) => [m, BGM_MOODS_CONFIG.moods[m].label]),
) as Record<BgmMood, string>

/**
 * 生成/挑选BGM用的音乐描述词。真身在 config/bgm-moods.json——
 * 曲库脚本是独立的 .mjs,导不了 TS,共用一份 JSON 才不会两边漂移。
 */
export const BGM_MOOD_PROMPTS: Record<BgmMood, string> = Object.fromEntries(
  BGM_MOODS.map((m) => [m, BGM_MOODS_CONFIG.moods[m].prompt]),
) as Record<BgmMood, string>

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

// ── 图文 ──────────────────────────────────────────────────────────────────────

/**
 * 一张卡片。版式是照着现有小红书号复刻的:
 * 上半配图,下半白卡——红色栏目标签 / 黑字第一行 / 砖红第二行 / 左红竖线带正文 / 右下页码。
 *
 * titleTop 和 titleBottom 必须成对读:第一行抛现象或否定,第二行给反转答案。
 * 「涨价救利润?」→「这条路到头了」、「最贵的不是厨师」→「是没有标准」。
 * 拆开单看任何一行都不成立,这是这个号最强的记忆点,不能退化成一句长标题。
 */
export interface NoteCard {
  idx: number
  /** 栏目标签,如「消费者心理 · 时段」。封面和内页可以不同 */
  label: string
  titleTop: string
  titleBottom: string
  /** 卡片正文(左侧红竖线右边那段)。封面是摘要,内页是这一页的论述 */
  body: string
  /** 内页可选的要点列表,最多 4 条,每条不超过 18 字 */
  bullets?: string[]
  /** 配图的生成提示词。风格由 NOTE_IMAGE_STYLE 统一兜底,这里只描述画面内容 */
  imagePrompt: string
}

export interface NoteOutput {
  label: string
  title_top: string
  title_bottom: string
  summary: string
  cards: Array<{
    label: string
    title_top: string
    title_bottom: string
    body: string
    bullets?: string[]
    image_prompt: string
  }>
  note_title: string
  body_text: string
  hashtags: string[]
  sources: Array<{ name: string; url?: string; published_at?: string }>
}

/**
 * 配图的统一风格前缀。账号里插画和实拍是交替出现的,但插画占多数、
 * 而且风格高度一致(暖色、线稿+柔和上色、中餐厅场景、真实的人)。
 * 风格必须写死在代码里而不是交给模型每次自由发挥,否则同一个号的图会各说各话。
 *
 * 末尾那句否定约束是必须的:生图模型很爱自己往画面里加中文标题和角标,
 * 生成的多半是乱码,又会和我们程序化叠上去的文字打架。
 */
/**
 * 不要文字的约束。这一句是 A/B 试出来的,别照直觉改。
 *
 * 试过三种写法,同一个场景(前台递信用卡)各生成两张:
 *   ① 点名带字的物件:「菜单、价目牌、收银机屏幕、招牌……一律不要写字」
 *      → 最差。黑板上工工整整写了两遍 Menu,小费罐上写了 tip。
 *      提到「菜单」等于让它画一块菜单板,提到「文字」等于让它想起文字。
 *   ② 完全不提
 *      → 中等,偶尔漏出乱码招牌。
 *   ③ 正面说这些面是空的(当前这句)
 *      → 最好。墙上挂轴、台面菜单都是空白的,只有信用卡上有点看不清的压印。
 *
 * 规律:否定式提示词会把被否定的东西召唤出来。要让画面没有字,
 * 就正面描述"这些表面是干净的",而不是罗列"不要写什么"。
 */
export const NOTE_NO_TEXT = '画面里所有平面都是干净的纯色或花纹,没有写字。'

/** 插画档:账号里占多数的那一档 */
export const NOTE_IMAGE_STYLE =
  '温暖的手绘插画风格,细腻线稿配柔和上色,暖橙与暖褐色调,光线柔和,' +
  '人物表情自然真实,生活化场景,构图饱满有细节,' +
  '类似高质量绘本或漫画分镜的质感。' +
  NOTE_NO_TEXT

/** 写实档:账号里和插画交替出现的实拍感配图(后厨、POS、菜单、手机点单) */
export const NOTE_PHOTO_STYLE =
  '真实摄影,自然光,浅景深,纪实风格,暖色调,画面干净有质感,' +
  '像专业餐饮杂志的配图。' +
  NOTE_NO_TEXT

export type NoteImageStyle = 'illustration' | 'photo'

export function imageStylePrompt(style: NoteImageStyle | string | undefined) {
  return style === 'photo' ? NOTE_PHOTO_STYLE : NOTE_IMAGE_STYLE
}

/** 一条笔记出几张卡:封面 1 张 + 内页 4-5 张,和账号现状一致(页码显示 01/05、01/06) */
export const NOTE_CARD_MIN = 5
export const NOTE_CARD_MAX = 6

/** 小红书封面比例 3:4(1080×1440)。竖屏 9:16 在 feed 里会被裁 */
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1440

export interface NoteQcReport {
  passed: boolean
  typos: string[]
  complianceIssues: string[]
  /** 来源核对:摘要和正文里引用的数字能不能对上 sources */
  sourceIssues: string[]
  notes: string
}

// ── 证据分级与质量门槛(按研发提示词) ─────────────────────────────────────────

/**
 * 主张的证据等级。核实 Agent 给每条主张定级,写稿只能把前两档当核心论点。
 * unverified_claim 不得出现在标题和核心结论里;conflicting_sources 必须
 * 呈现为「存在争议」,不许挑一个更顺手的版本。
 */
export const CLAIM_STATUSES = [
  'verified_fact',
  'supported_inference',
  'expert_opinion',
  'anecdotal_evidence',
  'unverified_claim',
  'outdated',
  'conflicting_sources',
] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  verified_fact: '已证实',
  supported_inference: '合理推断',
  expert_opinion: '专家观点',
  anecdotal_evidence: '个别经验',
  unverified_claim: '未证实',
  outdated: '可能过期',
  conflicting_sources: '来源冲突',
}

/** 一条主张及它的证据映射(ClaimEvidenceMap 的元素) */
export interface ClaimEvidence {
  id: string
  text: string
  type: 'fact' | 'inference' | 'opinion' | 'anecdote'
  status: ClaimStatus
  confidence: number
  source: string
  /** 适用地区(联邦/某州/某市)。法规类必填,写稿时不得跨范围推广 */
  jurisdiction?: string
  /** 时效(生效日期/statistics 的统计时点) */
  timeLimit?: string
  note?: string
}

/** 反方审稿的产出 */
export interface CriticReport {
  fatal: string[]
  major: string[]
  minor: string[]
  needsEvidence: string[]
  deleteSuggestions: string[]
  allowPublish: boolean
  /** 致命问题是否出在事实层(是→退回核实重走,不是改措辞能救的) */
  factLevelProblem: boolean
  confidence: number
}

/**
 * 百分制质量分。维度和权重照研发提示词:
 * 事实准确性20 实操价值20 北美适用性15 新颖10 逻辑10 视觉表达10 收藏5 转发5 可信5
 */
export interface QualityScores {
  factAccuracy: number
  practicalValue: number
  naFit: number
  novelty: number
  logic: number
  visual: number
  saveValue: number
  shareValue: number
  trust: number
  total: number
}

/** 发布门槛:任何一条不满足都不得进入待审批 */
export const QUALITY_GATE = {
  total: 85,
  factAccuracy: 18,
  practicalValue: 16,
} as const

/** 选题门槛(九维评分总分,低于它不进池) */
export const TOPIC_GATE = 75

/** 选题九维(用户痛点20 实操15 北美15 新颖10 证据15 收藏10 转发5 视觉5 空白5) */
export interface TopicDims {
  painPoint: number
  practical: number
  naRelevance: number
  novelty: number
  evidence: number
  saveValue: number
  shareValue: number
  visualPotential: number
  contentGap: number
  total: number
}

