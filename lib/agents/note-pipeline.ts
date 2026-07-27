import { prisma } from '../prisma'
import { generateJSON } from '../ai'
import {
  NOTE_CARD_MAX,
  NOTE_CARD_MIN,
  NOTE_STAGES,
  NoteCard,
  NoteOutput,
  NoteQcReport,
  ResearchOutput,
  imageStylePrompt,
  nextStage,
} from '../domain'
import {
  NOTE_QC_SYSTEM,
  NOTE_RESEARCH_SYSTEM,
  NOTE_WRITER_SYSTEM,
  noteQcUser,
  noteResearchUser,
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

// ── note ──────────────────────────────────────────────────────────────────────

async function runNote(item: NoteItem, qcFeedback?: unknown) {
  const meta = topicMeta(item)
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

  // 不通过就退回重写。和视频线一样限次数:一直返工会把钱烧在同一条上
  if (note.version >= MAX_QC_RETRY + 1) {
    throw new Error(
      `质检连续不通过 ${note.version} 次,停下等人看:${[
        ...(report.sourceIssues ?? []),
        ...(report.complianceIssues ?? []),
      ]
        .slice(0, 3)
        .join(';')}`,
    )
  }

  // 把质检意见带给写稿的那一步。不带的话它不知道上一版哪儿错了,
  // 只会原样再犯一遍,连着撞满重试次数
  const fresh = await loadNoteItem(item.id)
  if (fresh) await runNote(fresh, report)
  return { passed: false, rewrittenTo: note.version + 1, issues: report, stayInStage: true }
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
  note: runNote,
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
    const detail = await HANDLERS[stage](item, opts.budgetMs)

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
