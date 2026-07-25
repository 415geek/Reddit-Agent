import { prisma } from '../prisma'
import { generateJSON } from '../ai'
import { QcReport, ResearchOutput, ScriptBeats, Shot, STAGES, Stage } from '../domain'
import {
  QC_SYSTEM,
  RESEARCHER_SYSTEM,
  SCRIPTWRITER_SYSTEM,
  STORYBOARDER_SYSTEM,
  qcUser,
  researcherUser,
  scriptwriterUser,
  storyboarderUser,
} from '../prompts'
import { getMediaProviders } from '../providers'
import { logEvent } from './events'

interface ScriptOutput {
  beats: ScriptBeats
  fullText: string
  durationEstSec: number
  coverTitleLines: string[]
  coverTemplate: string
}

type ItemWithRelations = NonNullable<Awaited<ReturnType<typeof loadItem>>>

async function loadItem(itemId: string) {
  return prisma.contentItem.findUnique({
    where: { id: itemId },
    include: {
      topic: true,
      research: true,
      scripts: { orderBy: { version: 'desc' }, take: 1 },
      storyboards: { orderBy: { version: 'desc' }, take: 1 },
      assets: true,
    },
  })
}

async function runResearch(item: ItemWithRelations) {
  const out = await generateJSON<ResearchOutput>({
    system: RESEARCHER_SYSTEM,
    user: researcherUser(item.title, item.topic.hook, item.topic.category),
    maxTokens: 4096,
    mockKey: 'research',
    mockParams: { title: item.title },
  })
  await prisma.research.upsert({
    where: { contentItemId: item.id },
    update: {
      coreClaim: out.core_claim,
      supportingFacts: out.supporting_facts as unknown as object,
      counterarguments: out.counterarguments as unknown as object,
      riskNotes: out.risk_notes as unknown as object,
      usableExamples: out.usable_examples as unknown as object,
    },
    create: {
      contentItemId: item.id,
      coreClaim: out.core_claim,
      supportingFacts: out.supporting_facts as unknown as object,
      counterarguments: out.counterarguments as unknown as object,
      riskNotes: out.risk_notes as unknown as object,
      usableExamples: out.usable_examples as unknown as object,
    },
  })
  return { facts: out.supporting_facts.length }
}

async function runScript(item: ItemWithRelations) {
  if (!item.research) throw new Error('缺少研究资料,无法写脚本')
  const out = await generateJSON<ScriptOutput>({
    system: SCRIPTWRITER_SYSTEM,
    user: scriptwriterUser(item.title, {
      core_claim: item.research.coreClaim,
      supporting_facts: item.research.supportingFacts,
      usable_examples: item.research.usableExamples,
      risk_notes: item.research.riskNotes,
    }),
    maxTokens: 4096,
    mockKey: 'script',
    mockParams: { title: item.title },
  })
  const version = (item.scripts[0]?.version ?? 0) + 1
  await prisma.script.create({
    data: {
      contentItemId: item.id,
      version,
      beats: out.beats as unknown as object,
      fullText: out.fullText,
      durationEstSec: out.durationEstSec,
    },
  })
  await prisma.contentItem.update({
    where: { id: item.id },
    data: {
      coverTitleLines: out.coverTitleLines?.slice(0, 3) ?? [],
      coverTemplate: ['truth', 'counter', 'control'].includes(out.coverTemplate) ? out.coverTemplate : 'truth',
    },
  })
  return { version, durationEstSec: out.durationEstSec }
}

async function runStoryboard(item: ItemWithRelations) {
  const script = item.scripts[0]
  if (!script) throw new Error('缺少脚本,无法做分镜')
  const out = await generateJSON<{ shots: Shot[] }>({
    system: STORYBOARDER_SYSTEM,
    user: storyboarderUser(script.fullText, script.durationEstSec),
    maxTokens: 8192,
    mockKey: 'storyboard',
  })
  if (!out.shots?.length) throw new Error('分镜为空')
  const version = (item.storyboards[0]?.version ?? 0) + 1
  await prisma.storyboard.create({
    data: { contentItemId: item.id, version, shots: out.shots as unknown as object },
  })
  return { shots: out.shots.length, motionShots: out.shots.filter((s) => s.type === 'motion').length }
}

async function runAssets(item: ItemWithRelations) {
  const storyboard = item.storyboards[0]
  if (!storyboard) throw new Error('缺少分镜,无法生成资产')
  const shots = storyboard.shots as unknown as Shot[]
  const providers = getMediaProviders()

  // 封面背景:用第一个镜头的画面语言,但不带文字(标题由 /covers 页程序化叠加)
  const coverPrompt = shots[0].imagePrompt
  const coverBg = await providers.image.generateImage(coverPrompt, { itemId: item.id, name: 'cover_bg' })
  await prisma.asset.create({
    data: { contentItemId: item.id, kind: 'cover_bg', provider: coverBg.isMock ? 'mock' : 'seedream', path: coverBg.path, meta: coverBg.meta as object, isMock: coverBg.isMock },
  })

  // 分镜图(全部镜头都要底图;motion 镜头再图生视频)
  for (const shot of shots) {
    const img = await providers.image.generateImage(shot.imagePrompt, { itemId: item.id, name: `shot_${shot.idx}` })
    await prisma.asset.create({
      data: { contentItemId: item.id, kind: 'shot_image', shotIndex: shot.idx, provider: img.isMock ? 'mock' : 'seedream', path: img.path, meta: img.meta as object, isMock: img.isMock },
    })
    if (shot.type === 'motion' && shot.motionPrompt) {
      const clip = await providers.motion.generateMotion(img.path, shot.motionPrompt, { itemId: item.id, name: `motion_${shot.idx}`, durationSec: shot.durationSec })
      await prisma.asset.create({
        data: { contentItemId: item.id, kind: 'motion_clip', shotIndex: shot.idx, provider: clip.isMock ? 'mock' : 'seedance', path: clip.path, meta: clip.meta as object, isMock: clip.isMock },
      })
    }
  }
  return { images: shots.length + 1, motionClips: shots.filter((s) => s.type === 'motion').length }
}

async function runVoiceover(item: ItemWithRelations) {
  const script = item.scripts[0]
  if (!script) throw new Error('缺少脚本,无法配音')
  const providers = getMediaProviders()
  const vo = await providers.tts.synthesize(script.fullText, { itemId: item.id, name: 'voiceover' })
  await prisma.asset.create({
    data: { contentItemId: item.id, kind: 'voiceover', provider: vo.isMock ? 'mock' : 'doubao', path: vo.path, meta: vo.meta as object, isMock: vo.isMock },
  })
  // 简易字幕时间轴:按镜头 narration 与时长切分(SRT)
  const storyboard = item.storyboards[0]
  if (storyboard) {
    const shots = storyboard.shots as unknown as Shot[]
    let t = 0
    const fmt = (sec: number) => {
      const h = String(Math.floor(sec / 3600)).padStart(2, '0')
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
      const s = String(Math.floor(sec % 60)).padStart(2, '0')
      return `${h}:${m}:${s},000`
    }
    const srt = shots
      .map((shot, i) => {
        const start = t
        t += shot.durationSec
        return `${i + 1}\n${fmt(start)} --> ${fmt(t)}\n${shot.narration}\n`
      })
      .join('\n')
    const { saveAsset } = await import('../storage')
    const rel = `items/${item.id}/subtitles.srt`
    await saveAsset(rel, srt)
    await prisma.asset.create({
      data: { contentItemId: item.id, kind: 'subtitle', provider: 'mock', path: rel, meta: { cues: shots.length }, isMock: false },
    })
  }
  return { chars: script.fullText.length }
}

async function runCompose(item: ItemWithRelations) {
  const storyboard = item.storyboards[0]
  const voiceover = item.assets.find((a) => a.kind === 'voiceover') ??
    (await prisma.asset.findFirst({ where: { contentItemId: item.id, kind: 'voiceover' } }))
  if (!storyboard || !voiceover) throw new Error('缺少分镜或配音,无法合成')
  const providers = getMediaProviders()
  const final = await providers.compose.compose({
    itemId: item.id,
    shots: storyboard.shots as unknown as unknown[],
    voiceoverPath: voiceover.path,
  })
  await prisma.asset.create({
    data: { contentItemId: item.id, kind: 'final_video', provider: final.isMock ? 'mock' : 'remotion', path: final.path, meta: final.meta as object, isMock: final.isMock },
  })
  return { path: final.path }
}

async function runQc(item: ItemWithRelations) {
  const script = item.scripts[0]
  if (!script) throw new Error('缺少脚本,无法质检')
  const report = await generateJSON<QcReport>({
    system: QC_SYSTEM,
    user: qcUser({ beats: script.beats, fullText: script.fullText, durationEstSec: script.durationEstSec }, {
      core_claim: item.research?.coreClaim,
      supporting_facts: item.research?.supportingFacts,
    }),
    maxTokens: 2048,
    mockKey: 'qc',
  })
  await prisma.script.update({
    where: { id: script.id },
    data: { qcReport: report as unknown as object, status: report.passed ? 'passed_qc' : 'failed_qc' },
  })
  if (!report.passed) {
    throw new Error(`质检未通过:${report.notes || [...report.typos, ...report.complianceIssues].join('; ')}`)
  }
  return { passed: true }
}

const HANDLERS: Record<Stage, (item: ItemWithRelations) => Promise<Record<string, unknown>>> = {
  research: runResearch,
  script: runScript,
  storyboard: runStoryboard,
  assets: runAssets,
  voiceover: runVoiceover,
  compose: runCompose,
  qc: runQc,
  awaiting_approval: async () => ({ note: '等待人工审批,advance 不再推进' }),
}

/**
 * 推进一个生产单元到下一阶段。n8n 循环调用本函数,直到返回 stage=awaiting_approval。
 */
export async function advanceItem(itemId: string) {
  const item = await loadItem(itemId)
  if (!item) throw new Error(`ContentItem 不存在: ${itemId}`)
  const stage = item.stage as Stage
  if (!STAGES.includes(stage)) {
    return { itemId, stage: item.stage, done: true, note: '已离开自动流水线(审批/发布阶段)' }
  }
  if (stage === 'awaiting_approval') {
    return { itemId, stage, done: true, note: '等待人工审批' }
  }

  await logEvent({ contentItemId: itemId, stage, status: 'started' })
  try {
    const detail = await HANDLERS[stage](item)
    const nextStage = STAGES[STAGES.indexOf(stage) + 1]
    await prisma.contentItem.update({
      where: { id: itemId },
      data: {
        stage: nextStage,
        stageEnteredAt: new Date(),
        ...(nextStage === 'awaiting_approval' ? { producedAt: new Date() } : {}),
      },
    })
    await logEvent({ contentItemId: itemId, stage, status: 'succeeded', detail })
    return { itemId, stage: nextStage, done: nextStage === 'awaiting_approval', detail }
  } catch (e) {
    await logEvent({ contentItemId: itemId, stage, status: 'failed', error: String(e) })
    throw e
  }
}

/** 审批决定(web 或 telegram 通道共用) */
export async function decideApproval(itemId: string, decision: 'approved' | 'rejected', channel: 'web' | 'telegram', notes?: string, decidedBy?: string) {
  const item = await prisma.contentItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error(`ContentItem 不存在: ${itemId}`)
  if (item.stage !== 'awaiting_approval') throw new Error(`当前阶段是 ${item.stage},不可审批`)
  await prisma.approval.create({ data: { contentItemId: itemId, channel, decision, notes, decidedBy } })
  await prisma.contentItem.update({
    where: { id: itemId },
    data: { stage: decision, stageEnteredAt: new Date() },
  })
  if (decision === 'approved') {
    await prisma.topic.update({ where: { id: item.topicId }, data: { status: 'produced' } })
  }
  await logEvent({ contentItemId: itemId, stage: 'approval', status: 'succeeded', detail: { decision, channel } })
  return { itemId, decision }
}
