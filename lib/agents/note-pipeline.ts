import { prisma } from '../prisma'
import { generateJSON, takeLastUsage } from '../ai'
import {
  ClaimEvidence,
  CriticReport,
  NOTE_CARD_MAX,
  NOTE_CARD_MIN,
  NOTE_STAGES,
  NoteCard,
  NoteOutput,
  NoteQcReport,
  QUALITY_GATE,
  QualityScores,
  ResearchOutput,
  imageStylePrompt,
  nextStage,
} from '../domain'
import {
  NOTE_CRITIC_SYSTEM,
  NOTE_QC_SYSTEM,
  NOTE_RESEARCH_SYSTEM,
  NOTE_VERIFY_SYSTEM,
  NOTE_WRITER_SYSTEM,
  noteCriticUser,
  noteQcUser,
  noteResearchUser,
  noteVerifyUser,
  noteWriterUser,
} from '../prompts/note'
import { getMediaProviders, providerLabels } from '../providers'
import { renderCardPng } from '../cards/render'
import { saveAsset } from '../storage'
import { logEvent } from './events'
import { fetchArticleText } from '../sources/fetch'

/**
 * 图文的阶段机:research → note → qc → cards → awaiting_approval
 *
 * 和视频那条线分开写,而不是塞进同一个 HANDLERS 表:两者的阶段序列、产物、
 * 花钱的地方都不一样,硬合在一起每个函数都要先判断 kind,读起来比分开还累。
 * 共用的只有 loadItem 的形状和事件日志。
 */

const MAX_QC_RETRY = Number(process.env.NOTE_QC_MAX_RETRY || 2)

type NoteItem = NonNullable<Awaited<ReturnType<typeof loadNoteItem>>>

async function loadNoteItem(itemId: string) {
  return prisma.contentItem.findUnique({
    where: { id: itemId },
    include: {
      topic: { include: { sourceItem: true } },
      research: true,
      notes: { orderBy: { version: 'desc' }, take: 1 },
      assets: true,
    },
  })
}

/** 选题时存在 Topic.notes 里的那一坨。存 JSON 是为了不给 Topic 加一堆只有图文用的列 */
function topicMeta(item: NoteItem) {
  const fallback = {
    titleTop: item.title.split(' / ')[0] ?? item.title,
    titleBottom: item.title.split(' / ')[1] ?? '',
    noteTitle: item.title,
    angle: item.topic.hook ?? '',
  }
  if (!item.topic.notes) return fallback
  try {
    return { ...fallback, ...(JSON.parse(item.topic.notes) as Record<string, string>) }
  } catch {
    return fallback
  }
}

function sourcePayload(item: NoteItem) {
  const s = item.topic.sourceItem
  if (!s) return { note: '这条选题没有挂原始素材' }
  return {
    title: s.title,
    source: s.source,
    url: s.url,
    publishedAt: s.publishedAt?.toISOString().slice(0, 10) ?? null,
    summary: s.summary,
    // 全文优先。RSS 摘要只有两三百字,一个数字翻来覆去用;
    // 原文里通常有七八个支撑数字和日期,专业感的差距主要在这儿
    fullText: s.rawText ?? undefined,
    // 摘要的出身决定它算不算证据:RSS 描述是来源方自己写的,可当原文对待;
    // 检索转述是我们自己的复述,必须以 fullText 核对
    summaryNote: s.feedId
      ? '本摘要来自来源方自己发布的 RSS 描述,可作为其原文的一部分对待'
      : '本摘要是编辑联网检索时的转述,不算原文依据;数字必须能在 fullText 里找到,找不到按 unverified 处理',
    category: s.category,
  }
}

/**
 * 确保选题的原始素材抓过全文。research 阶段进来先跑这一步:
 * 抓到就存回 SourceItem.rawText(后面写稿、返工都复用,不重复抓),
 * 抓不到(付费墙、纯 JS 站)就退回摘要照常走,不阻塞。
 */
async function ensureFullText(item: NoteItem) {
  const s = item.topic.sourceItem
  if (!s || s.rawText) return
  const text = await fetchArticleText(s.url)
  if (!text) return
  await prisma.sourceItem.update({ where: { id: s.id }, data: { rawText: text } })
  s.rawText = text
}

// ── research ──────────────────────────────────────────────────────────────────

interface NoteResearchOutput extends ResearchOutput {
  action_items?: string[]
}

async function runResearch(item: NoteItem) {
  await ensureFullText(item)
  const meta = topicMeta(item)
  const out = await generateJSON<NoteResearchOutput>({
    system: NOTE_RESEARCH_SYSTEM,
    user: noteResearchUser(
      { titleTop: meta.titleTop, titleBottom: meta.titleBottom, angle: meta.angle },
      sourcePayload(item),
    ),
    maxTokens: 4096,
    mockKey: 'note.research',
    mockParams: { title: item.title },
  })

  const payload = {
    coreClaim: out.core_claim ?? item.title,
    supportingFacts: (out.supporting_facts ?? []) as unknown as object,
    counterarguments: (out.counterarguments ?? []) as unknown as object,
    riskNotes: (out.risk_notes ?? []) as unknown as object,
    // 可用素材和"今晚能做的动作"合并存一列:写稿时它们是同一种东西——
    // 都是能落到卡片上的具体内容,分两列存反而要在下游拼回去
    usableExamples: [...(out.usable_examples ?? []), ...(out.action_items ?? [])] as unknown as object,
  }
  await prisma.research.upsert({
    where: { contentItemId: item.id },
    update: payload,
    create: { contentItemId: item.id, ...payload },
  })
  return { facts: out.supporting_facts?.length ?? 0, actions: out.action_items?.length ?? 0 }
}

// ── verify:证据核查(独立于挖料和写稿) ──────────────────────────────────────

interface VerifyOutput {
  claims: ClaimEvidence[]
  core_claim_id?: string
  verdict: 'pass' | 'degraded' | 'fail'
  degraded_scope?: string
  blockers?: string[]
}

async function runVerify(item: NoteItem) {
  if (!item.research) throw new Error('没有研究材料,无法核查')
  const out = await generateJSON<VerifyOutput>({
    system: NOTE_VERIFY_SYSTEM,
    user: noteVerifyUser(item.research, sourcePayload(item)),
    maxTokens: 4096,
    mockKey: 'note.verify',
  })

  const claims = out.claims ?? []
  await prisma.research.update({
    where: { contentItemId: item.id },
    data: {
      claims: claims as unknown as object,
      // 降级口径写回 riskNotes,写稿的输入里自然带上
      ...(out.verdict === 'degraded' && out.degraded_scope
        ? {
            // 先滤掉旧的降级行再追加:critic 退回 verify 重核时这里会再跑一遍,
            // 不滤的话每回跳一次就叠一条,写稿输入越滚越长
            riskNotes: [
              ...(((item.research.riskNotes as string[] | null) ?? []).filter(
                (r) => typeof r !== 'string' || !r.startsWith('【核查降级】'),
              )),
              `【核查降级】全文必须按此口径:${out.degraded_scope}`,
            ] as unknown as object,
          }
        : {}),
    },
  })

  // 失败关闭:核心主张站不住,这条不做。抛错让熔断和看板接手,
  // 不许"先写着,写完再说"——那就是幻觉的生产流程
  if (out.verdict === 'fail') {
    throw new Error(`核查不通过,选题不能做:${(out.blockers ?? []).join(';').slice(0, 200) || '核心主张无法证实'}`)
  }

  const counts = claims.reduce<Record<string, number>>((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {})
  return { verdict: out.verdict, claims: claims.length, byStatus: counts }
}

// ── critic:反方审稿(专职推翻) ─────────────────────────────────────────────

/** 反方审稿最多打回几轮。事实层问题退回核查,写作层问题退回重写,各占额度 */
const MAX_CRITIC_ROUNDS = Number(process.env.NOTE_CRITIC_MAX_ROUNDS || 2)

interface CriticOutput extends CriticReport {
  scores: QualityScores
}

async function runCritic(item: NoteItem) {
  const note = item.notes[0]
  if (!note) throw new Error('还没有稿子,无法审')

  // 额度先查,再花钱。额度用完的条目不该每次重试都白烧一次审稿调用,
  // 也不该永远卡在生产队列里——直接打成 rejected,人从「已拒绝」里看原因。
  // 这就是"停下等人看"的落地形态:停是真的停,原因摆在明面上
  const spentRounds = await prisma.pipelineEvent.count({
    where: { contentItemId: item.id, stage: 'critic', status: 'succeeded' },
  })
  if (spentRounds > MAX_CRITIC_ROUNDS) {
    const lastReport = note.criticReport as { fatal?: string[]; major?: string[] } | null
    const why = [...(lastReport?.fatal ?? []), ...(lastReport?.major ?? [])].slice(0, 2).join(';').slice(0, 200)
    await prisma.contentItem.update({ where: { id: item.id }, data: { stage: 'rejected' } })
    await prisma.topic.update({ where: { id: item.topicId }, data: { status: 'rejected' } }).catch(() => {})
    return { rejectedByCritic: true, halt: true, reason: why || '多轮审稿未达标' }
  }

  const out = await generateJSON<CriticOutput>({
    system: NOTE_CRITIC_SYSTEM,
    user: noteCriticUser(
      {
        titles: { top: note.titleTop, bottom: note.titleBottom, feed: note.noteTitle },
        summary: note.summary,
        cards: note.cards,
        bodyText: note.bodyText,
        sources: note.sources,
      },
      item.research?.claims ?? [],
      { coreClaim: item.research?.coreClaim, riskNotes: item.research?.riskNotes },
    ),
    maxTokens: 4096,
    mockKey: 'note.critic',
  })

  const scores = out.scores
  const gatePassed =
    out.allowPublish &&
    (out.fatal ?? []).length === 0 &&
    (scores?.total ?? 0) >= QUALITY_GATE.total &&
    (scores?.factAccuracy ?? 0) >= QUALITY_GATE.factAccuracy &&
    (scores?.practicalValue ?? 0) >= QUALITY_GATE.practicalValue

  await prisma.note.update({
    where: { id: note.id },
    data: {
      // gatePassed 一并存进去:写稿返工时要靠它分辨"这份报告是打回意见"
      // 还是"上一版已经过审的存档"
      criticReport: { ...out, gatePassed } as unknown as object,
      qualityScores: (scores ?? null) as unknown as object,
    },
  })

  if (gatePassed) {
    return { passed: true, total: scores?.total, fact: scores?.factAccuracy, practical: scores?.practicalValue }
  }

  const summary = [...(out.fatal ?? []), ...(out.major ?? [])].slice(0, 3).join(';').slice(0, 250)
  if (spentRounds >= MAX_CRITIC_ROUNDS) {
    // 这是最后一轮,仍不达标:停产。不抛错——抛错会被当成"临时故障"进重试循环,
    // 而这是终审结论,要的是落停,不是重试
    await prisma.contentItem.update({ where: { id: item.id }, data: { stage: 'rejected' } })
    await prisma.topic.update({ where: { id: item.topicId }, data: { status: 'rejected' } }).catch(() => {})
    return { rejectedByCritic: true, halt: true, total: scores?.total, reason: summary }
  }

  // 事实层的致命问题:退回核查重走,不是改措辞能救的。
  // 研发提示词的原话:「如果发现事实错误,必须退回事实核查或研究阶段,
  // 不能只让写作 Agent 修改措辞」
  if (out.factLevelProblem) {
    return { passed: false, backTo: 'verify', reason: summary, scores: scores?.total }
  }

  // 写作层问题:回跳到写稿阶段,由下一次调用带着报告重写。
  // 不在这里内联重写——审稿+重写是两次模型调用,加起来 70-90 秒,
  // 必超 serverless 的 60 秒上限;函数被杀在重写中途,轮次事件没落库,
  // 下一次进来会把审稿整个重烧一遍,线上实测就是这样死循环烧钱的
  return { passed: false, backTo: 'note', reason: summary, scores: scores?.total }
}

// ── note ──────────────────────────────────────────────────────────────────────

async function runNote(item: NoteItem, qcFeedback?: unknown) {
  const meta = topicMeta(item)
  // 返工场景(critic/qc 打回后回跳到本阶段):反馈存在上一版笔记上。
  // 只把"没过关"的报告当反馈——过了审的存档不是意见,喂回去只会让模型困惑
  if (qcFeedback == null) {
    const last = item.notes[0]
    const cr = last?.criticReport as ({ gatePassed?: boolean } & Record<string, unknown>) | null
    if (last?.status === 'failed_qc' && last.qcReport) {
      qcFeedback = { 合规终审意见: last.qcReport }
    } else if (cr && cr.gatePassed === false) {
      qcFeedback = { 反方审稿意见: cr }
    }
  }
  const out = await generateJSON<NoteOutput>({
    system: NOTE_WRITER_SYSTEM,
    user: noteWriterUser(
      {
        titleTop: meta.titleTop,
        titleBottom: meta.titleBottom,
        noteTitle: meta.noteTitle,
        angle: meta.angle,
        category: item.topic.category,
      },
      item.research,
      sourcePayload(item),
      qcFeedback,
      item.research?.claims ?? [],
    ),
    maxTokens: 8192,
    mockKey: 'note.write',
    mockParams: { title: item.title },
  })

  // 封面是第 0 张。模型只写内页,封面由 label/title/summary 拼出来——
  // 让模型自己在 cards[0] 放封面试过,它经常把封面写成一张普通内页,
  // 那条固定的摘要公式(来源+数字 → 意味着什么 → 今晚做什么)就丢了
  const inner = (out.cards ?? []).slice(0, NOTE_CARD_MAX - 1)
  if (inner.length < NOTE_CARD_MIN - 1) {
    throw new Error(`内页只有 ${inner.length} 张,至少要 ${NOTE_CARD_MIN - 1} 张`)
  }

  const cards: NoteCard[] = [
    {
      idx: 0,
      label: out.label,
      titleTop: out.title_top,
      titleBottom: out.title_bottom,
      body: out.summary,
      imagePrompt: inner[0]?.image_prompt ?? out.summary,
    },
    ...inner.map((c, i) => ({
      idx: i + 1,
      label: c.label,
      titleTop: c.title_top,
      titleBottom: c.title_bottom,
      body: c.body,
      bullets: c.bullets,
      imagePrompt: c.image_prompt,
    })),
  ]

  const version = (item.notes[0]?.version ?? 0) + 1
  await prisma.note.create({
    data: {
      contentItemId: item.id,
      version,
      label: out.label,
      titleTop: out.title_top,
      titleBottom: out.title_bottom,
      summary: out.summary,
      cards: cards as unknown as object,
      noteTitle: out.note_title,
      bodyText: out.body_text,
      hashtags: out.hashtags ?? [],
      sources: (out.sources ?? []) as unknown as object,
    },
  })
  // 封面标题同步到 ContentItem,看板列表直接用得上
  await prisma.contentItem.update({
    where: { id: item.id },
    data: { coverTitleLines: [out.title_top, out.title_bottom] },
  })
  return { version, cards: cards.length, hashtags: out.hashtags?.length ?? 0 }
}

// ── qc ────────────────────────────────────────────────────────────────────────

async function runQc(item: NoteItem) {
  const note = item.notes[0]
  if (!note) throw new Error('还没有笔记,无法质检')

  const report = await generateJSON<NoteQcReport>({
    system: NOTE_QC_SYSTEM,
    user: noteQcUser(note, item.research),
    maxTokens: 3072,
    mockKey: 'note.qc',
  })

  await prisma.note.update({
    where: { id: note.id },
    data: { qcReport: report as unknown as object, status: report.passed ? 'passed_qc' : 'failed_qc' },
  })
  if (report.passed) return { passed: true }

  // 不通过就打回重写,限次数:一直返工会把钱烧在同一条上
  if (note.version >= MAX_QC_RETRY + 1) {
    await prisma.contentItem.update({ where: { id: item.id }, data: { stage: 'rejected' } })
    await prisma.topic.update({ where: { id: item.topicId }, data: { status: 'rejected' } }).catch(() => {})
    return {
      rejectedByQc: true,
      halt: true,
      reason: [...(report.sourceIssues ?? []), ...(report.complianceIssues ?? [])].slice(0, 3).join(';').slice(0, 200),
    }
  }

  // 回跳写稿,由下一次调用带着意见重写(qcReport 已存在笔记上,
  // runNote 返工时自己会取)。不内联重写,原因同 critic:两次模型调用必超函数上限
  return { passed: false, backTo: 'note', issues: report }
}

// ── cards ─────────────────────────────────────────────────────────────────────

/**
 * 出配图 + 渲染卡片。这一阶段是唯一花钱的地方(只花在生图上)。
 *
 * 有时间预算:serverless 有函数上限,一条笔记 5-6 张图、每张 7-9 秒,
 * 一次跑不完很正常。所以做成可续跑的——已经出过的图不重出,
 * 下一轮心跳接着做剩下的。
 */
async function runCards(item: NoteItem, budgetMs?: number) {
  const note = item.notes[0]
  if (!note) throw new Error('还没有笔记,无法出图')
  const cards = note.cards as unknown as NoteCard[]

  const deadline = budgetMs ? Date.now() + budgetMs : Infinity
  const outOfTime = () => Date.now() > deadline - 12_000

  const { image } = getMediaProviders()
  const labels = providerLabels()

  const imageByIdx = new Map(item.assets.filter((a) => a.kind === 'card_image').map((a) => [a.shotIndex, a]))
  const finalByIdx = new Map(item.assets.filter((a) => a.kind === 'card_final').map((a) => [a.shotIndex, a]))

  let madeImages = 0
  let madeCards = 0

  for (const card of cards) {
    if (outOfTime()) break
    if (finalByIdx.has(card.idx)) continue

    // 1. 配图。封面和第一张内页共用一张图——账号本来也不是每页一张新图,
    //    这样一条笔记的图从 6 张降到 5 张
    const imageIdx = card.idx === 0 ? 1 : card.idx
    let img = imageByIdx.get(imageIdx)
    if (!img) {
      const style = (cards.find((c) => c.idx === imageIdx) ?? card) as NoteCard & { imageStyle?: string }
      const prompt = `${card.imagePrompt}。${imageStylePrompt((style as { imageStyle?: string }).imageStyle)}`
      const gen = await image.generateImage(prompt, { itemId: item.id, name: `card_${imageIdx}` })
      img = await prisma.asset.create({
        data: {
          contentItemId: item.id,
          kind: 'card_image',
          shotIndex: imageIdx,
          provider: labels.image,
          path: gen.path,
          meta: gen.meta as object,
          isMock: gen.isMock,
        },
      })
      imageByIdx.set(imageIdx, img)
      madeImages++
      if (outOfTime()) break
    }

    // 2. 渲染整张卡片
    const png = await renderCardPng({
      label: card.label,
      titleTop: card.titleTop,
      titleBottom: card.titleBottom,
      body: card.body,
      bullets: card.bullets,
      imagePath: img.path,
      pageNo: card.idx + 1,
      pageTotal: cards.length,
    })
    const path = await saveAsset(`items/${item.id}/card_final_${card.idx}.png`, png)
    const asset = await prisma.asset.create({
      data: {
        contentItemId: item.id,
        kind: 'card_final',
        shotIndex: card.idx,
        provider: 'og',
        path,
        meta: { bytes: png.length },
      },
    })
    finalByIdx.set(card.idx, asset)
    madeCards++
  }

  const remaining = cards.length - finalByIdx.size
  if (remaining > 0) {
    return { madeImages, madeCards, done: finalByIdx.size, total: cards.length, remaining, stayInStage: true }
  }
  return { madeImages, madeCards, cards: cards.length }
}

// ── 阶段机 ────────────────────────────────────────────────────────────────────

type Handler = (item: NoteItem, budgetMs?: number) => Promise<Record<string, unknown>>

const HANDLERS: Record<string, Handler> = {
  research: runResearch,
  verify: runVerify,
  note: runNote,
  critic: runCritic,
  qc: runQc,
  cards: runCards,
}

export async function advanceNoteItem(itemId: string, opts: { budgetMs?: number } = {}) {
  const item = await loadNoteItem(itemId)
  if (!item) throw new Error(`ContentItem 不存在: ${itemId}`)
  const stage = item.stage
  if (!(NOTE_STAGES as readonly string[]).includes(stage)) {
    return { itemId, stage, done: true, note: '已离开自动流水线(审批/发布阶段)' }
  }
  if (stage === 'awaiting_approval') return { itemId, stage, done: true, note: '等待人工审批' }

  await logEvent({ contentItemId: itemId, stage, status: 'started' })
  try {
    takeLastUsage() // 清零,只统计本阶段
    const detail = await HANDLERS[stage](item, opts.budgetMs)
    const usage = takeLastUsage()
    if (usage.inputTokens || usage.outputTokens) {
      detail.tokens = { in: usage.inputTokens, out: usage.outputTokens }
    }

    // 终审否决:handler 已把条目落到终态(rejected),推进逻辑一步都不能再走。
    // 没有这一道,被判死的稿子会照常走完 qc→cards 进待审批——上线前的端到端
    // 实测真的发生了:69 分的稿子被判死后又完整走完了生产线。失败必须关闭。
    if (detail.halt) {
      await logEvent({ contentItemId: itemId, stage, status: 'succeeded', detail })
      return { itemId, stage: 'rejected', done: true, detail }
    }

    // 反方审稿发现事实层问题:退回指定阶段重走(研发提示词的硬要求)
    if (typeof detail.backTo === 'string') {
      await prisma.contentItem.update({
        where: { id: itemId },
        data: { stage: detail.backTo, stageEnteredAt: new Date() },
      })
      await logEvent({ contentItemId: itemId, stage, status: 'succeeded', detail })
      return { itemId, stage: detail.backTo, done: false, retried: true, detail }
    }

    if (detail.stayInStage) {
      await prisma.contentItem.update({ where: { id: itemId }, data: { stageEnteredAt: new Date() } })
      await logEvent({ contentItemId: itemId, stage, status: 'succeeded', detail })
      return { itemId, stage, done: false, retried: true, detail }
    }

    const next = nextStage('note', stage) ?? 'awaiting_approval'
    await prisma.contentItem.update({
      where: { id: itemId },
      data: {
        stage: next,
        stageEnteredAt: new Date(),
        ...(next === 'awaiting_approval' ? { producedAt: new Date() } : {}),
      },
    })
    // 走到审批就把素材标成已用,不会再被挑成新选题
    if (next === 'awaiting_approval' && item.topic.sourceItemId) {
      await prisma.sourceItem.update({ where: { id: item.topic.sourceItemId }, data: { status: 'used' } })
    }
    await logEvent({ contentItemId: itemId, stage, status: 'succeeded', detail })
    return { itemId, stage: next, done: next === 'awaiting_approval', detail }
  } catch (e) {
    await logEvent({ contentItemId: itemId, stage, status: 'failed', error: String(e) })
    throw e
  }
}
