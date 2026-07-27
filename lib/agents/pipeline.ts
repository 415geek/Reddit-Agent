import { prisma } from '../prisma'
import { generateJSON } from '../ai'
import { QcReport, ResearchOutput, ScriptBeats, Shot, STAGES, Stage, pickBgmMood } from '../domain'
import { ensureBgmAsset } from '../bgm'
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
import { getMediaProviders, providerLabels } from '../providers'
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
      // 不用模型自报的 durationEstSec:实测它系统性低估。按字数算才和配音对得上。
      durationEstSec: estimateDurationSec(out.fullText),
    },
  })
  await prisma.contentItem.update({
    where: { id: item.id },
    data: {
      coverTitleLines: out.coverTitleLines?.slice(0, 3) ?? [],
      coverTemplate: ['truth', 'counter', 'control'].includes(out.coverTemplate) ? out.coverTemplate : 'truth',
    },
  })
  return { version, durationEstSec: estimateDurationSec(out.fullText), chars: scriptChars(out.fullText) }
}

async function runStoryboard(item: ItemWithRelations) {
  const script = item.scripts[0]
  if (!script) throw new Error('缺少脚本,无法做分镜')
  const out = await generateJSON<{ shots: Shot[]; bgmMood?: string; turnShotIdx?: number }>({
    system: STORYBOARDER_SYSTEM,
    user: storyboarderUser(script.fullText, script.durationEstSec),
    maxTokens: 8192,
    mockKey: 'storyboard',
  })
  if (!out.shots?.length) throw new Error('分镜为空')
  const bgmMood = pickBgmMood({
    bgmMood: out.bgmMood,
    coverTemplate: item.coverTemplate,
    category: item.topic?.category,
  })
  // 模型给的反转点下标可能越界,越界就当没标(合成时退回无断点)
  const turnShotIdx =
    typeof out.turnShotIdx === 'number' && out.shots.some((s) => s.idx === out.turnShotIdx) ? out.turnShotIdx : null
  const version = (item.storyboards[0]?.version ?? 0) + 1
  await prisma.storyboard.create({
    data: { contentItemId: item.id, version, shots: out.shots as unknown as object, bgmMood, turnShotIdx },
  })
  return {
    shots: out.shots.length,
    motionShots: out.shots.filter((s) => s.type === 'motion').length,
    bgmMood,
    turnShotIdx,
  }
}

/**
 * 单次 advance 的资产生成时间预算。真实生成一张图约8秒、一段图生视频约70秒,
 * 一条内容 12图+3视频要 300 秒以上,远超 serverless 函数上限。
 * 所以这一阶段做成可续跑:每次只做到预算用完,已完成的资产跳过,反复调用直到做完。
 */
const ASSET_BUDGET_MS = Number(process.env.ASSET_BUDGET_MS || 40_000)

/**
 * 最多做几段图生视频。默认 0 —— 完全不做。
 *
 * 图生视频是整条流水线最贵的一项:实测账单里它占 90%(一段 720p 5秒约 $0.32,
 * 而静态图只要 $0.03)。合成时静态图本来就有推近/拉远/横移的运镜,
 * 国内不少知识号就是这个形态。要恢复动态镜头把这个值调大即可。
 */
const MAX_MOTION_SHOTS = Number(process.env.MAX_MOTION_SHOTS ?? 0)

/**
 * 图生视频的否定约束。实测 Seedance 会自作主张给画面配上中文大标题和角标,
 * 而且多半是乱码,还会和我们烧上去的字幕叠在一起。分镜提示词里写一句不够,
 * 在调用前统一补一遍。
 */
function cleanMotionPrompt(prompt: string) {
  const base = prompt.replace(/,?\s*画面中不出现任何文字、字幕、标题或水印\s*$/, '')
  return `${base},画面中绝对不能出现任何文字、字幕、标题、角标、logo 或水印`
}

async function runAssets(item: ItemWithRelations, budgetMs?: number) {
  const storyboard = item.storyboards[0]
  if (!storyboard) throw new Error('缺少分镜,无法生成资产')
  const shots = storyboard.shots as unknown as Shot[]
  const providers = getMediaProviders()
  const labels = providerLabels()
  // 心跳批量推进时会传更小的预算进来:一次心跳要照顾多条内容,
  // 不能让一条把整轮的时间吃光
  const deadline = Date.now() + (budgetMs ?? ASSET_BUDGET_MS)

  // 已有资产:断点续跑的依据
  const existing = await prisma.asset.findMany({
    where: { contentItemId: item.id, kind: { in: ['cover_bg', 'shot_image', 'motion_clip'] } },
  })
  const hasCover = existing.some((a) => a.kind === 'cover_bg')
  const imageByShot = new Map(existing.filter((a) => a.kind === 'shot_image').map((a) => [a.shotIndex, a]))
  const motionDone = new Set(existing.filter((a) => a.kind === 'motion_clip').map((a) => a.shotIndex))

  let made = 0
  const outOfTime = () => Date.now() > deadline

  // 封面背景:沿用第一个镜头的画面语言,但必须干净无字——标题由 /covers 页程序化叠加,
  // 画面里再出现数字/招牌/价签会和叠加的标题打架。实测模型会无视单薄的"不要文字",故加重约束。
  if (!hasCover) {
    const coverPrompt =
      shots[0].imagePrompt.replace(/,?\s*不要文字,不要Logo,不要水印\s*$/, '') +
      ',画面中绝对不能出现任何文字、数字、字母、价格标签、招牌、logo、水印或可辨认的符号'
    const coverBg = await providers.image.generateImage(coverPrompt, { itemId: item.id, name: 'cover_bg' })
    await prisma.asset.create({
      data: { contentItemId: item.id, kind: 'cover_bg', provider: labels.image, path: coverBg.path, meta: coverBg.meta as object, isMock: coverBg.isMock },
    })
    made++
  }

  // 只给前 MAX_MOTION_SHOTS 个 motion 镜头真的做图生视频,其余退回静态图+运镜
  const motionAllowed = new Set(
    shots.filter((s) => s.type === 'motion' && s.motionPrompt).slice(0, MAX_MOTION_SHOTS).map((s) => s.idx),
  )

  // 分镜图(全部镜头都要底图;选中的 motion 镜头再图生视频)
  for (const shot of shots) {
    if (outOfTime()) break

    let img = imageByShot.get(shot.idx)
    if (!img) {
      const gen = await providers.image.generateImage(shot.imagePrompt, { itemId: item.id, name: `shot_${shot.idx}` })
      img = await prisma.asset.create({
        data: { contentItemId: item.id, kind: 'shot_image', shotIndex: shot.idx, provider: labels.image, path: gen.path, meta: gen.meta as object, isMock: gen.isMock },
      })
      made++
    }

    if (shot.type === 'motion' && shot.motionPrompt && motionAllowed.has(shot.idx) && !motionDone.has(shot.idx)) {
      // 和封面同样的教训:图生视频模型很爱自己往画面里加中文标题和角标,
      // 生成的还多半是乱码,又会和我们烧上去的字幕打架,所以在这里硬加否定约束。
      const motionPrompt = cleanMotionPrompt(shot.motionPrompt)
      const motionOpts = { itemId: item.id, name: `motion_${shot.idx}`, durationSec: shot.durationSec }
      const imageFile = { path: img.path, meta: (img.meta ?? {}) as Record<string, unknown>, isMock: img.isMock }
      const jobKey = `motion_job:${item.id}:${shot.idx}`

      // 云端异步两段式:一段视频要 60-90 秒,同步等必然超函数上限
      if (providers.motion.startMotion && providers.motion.pollMotion) {
        const saved = await prisma.setting.findUnique({ where: { key: jobKey } })
        let jobId = (saved?.value as { jobId?: string } | null)?.jobId

        if (!jobId) {
          if (outOfTime()) break
          jobId = (await providers.motion.startMotion(imageFile, motionPrompt, motionOpts)).jobId
          await prisma.setting.upsert({
            where: { key: jobKey },
            update: { value: { jobId } },
            create: { key: jobKey, value: { jobId } },
          })
          continue // 这一轮先不等,下一次 advance 来取
        }

        const clip = await providers.motion.pollMotion(jobId, motionOpts)
        if (!clip) continue // 还在跑,下一轮再来
        await prisma.asset.create({
          data: { contentItemId: item.id, kind: 'motion_clip', shotIndex: shot.idx, provider: labels.motion, path: clip.path, meta: clip.meta as object, isMock: clip.isMock },
        })
        await prisma.setting.delete({ where: { key: jobKey } }).catch(() => {})
        made++
      } else {
        // 同步路径(mock / 自托管无超时限制)
        if (outOfTime()) break
        const clip = await providers.motion.generateMotion(imageFile, motionPrompt, motionOpts)
        await prisma.asset.create({
          data: { contentItemId: item.id, kind: 'motion_clip', shotIndex: shot.idx, provider: labels.motion, path: clip.path, meta: clip.meta as object, isMock: clip.isMock },
        })
        made++
      }
    }
  }

  // 统计还差多少
  const after = await prisma.asset.findMany({
    where: { contentItemId: item.id, kind: { in: ['cover_bg', 'shot_image', 'motion_clip'] } },
    select: { kind: true, shotIndex: true },
  })
  const doneImages = after.filter((a) => a.kind === 'shot_image').length
  const doneMotions = after.filter((a) => a.kind === 'motion_clip').length
  const wantMotions = motionAllowed.size
  const remaining = shots.length - doneImages + (wantMotions - doneMotions)

  if (remaining > 0) {
    return { madeThisRound: made, images: doneImages, motionClips: doneMotions, remaining, stayInStage: true }
  }
  return { images: doneImages + 1, motionClips: doneMotions }
}

async function runVoiceover(item: ItemWithRelations) {
  const script = item.scripts[0]
  if (!script) throw new Error('缺少脚本,无法配音')
  const providers = getMediaProviders()
  const labels = providerLabels()
  const ttsOpts = { itemId: item.id, name: 'voiceover' }

  // 已经配过音就跳过(异步两段式下这一阶段会被调用多次)
  let voAsset = await prisma.asset.findFirst({ where: { contentItemId: item.id, kind: 'voiceover' } })
  if (!voAsset) {
    // 云端异步两段式:581 字的稿子同步合成实测会撞上函数上限,
    // 整个阶段超时死掉、什么都不留下,下一次还是从头再来。
    if (providers.tts.startSynthesize && providers.tts.pollSynthesize) {
      const jobKey = `tts_job:${item.id}`
      const saved = await prisma.setting.findUnique({ where: { key: jobKey } })
      let jobId = (saved?.value as { jobId?: string } | null)?.jobId

      if (!jobId) {
        jobId = (await providers.tts.startSynthesize(script.fullText, ttsOpts)).jobId
        await prisma.setting.upsert({ where: { key: jobKey }, update: { value: { jobId } }, create: { key: jobKey, value: { jobId } } })
        return { submitted: true, stayInStage: true }
      }

      const done = await providers.tts.pollSynthesize(jobId, ttsOpts)
      if (!done) return { waitingForTts: true, stayInStage: true }
      voAsset = await prisma.asset.create({
        data: {
          contentItemId: item.id,
          kind: 'voiceover',
          provider: labels.tts,
          path: done.path,
          meta: { ...(done.meta as object), chars: script.fullText.length },
          isMock: done.isMock,
        },
      })
      await prisma.setting.delete({ where: { key: jobKey } }).catch(() => {})
    } else {
      const vo = await providers.tts.synthesize(script.fullText, ttsOpts)
      voAsset = await prisma.asset.create({
        data: { contentItemId: item.id, kind: 'voiceover', provider: labels.tts, path: vo.path, meta: vo.meta as object, isMock: vo.isMock },
      })
    }
  }
  // 简易字幕时间轴:按镜头 narration 与时长切分(SRT)
  const storyboard = item.storyboards[0]
  const hasSubtitle = await prisma.asset.findFirst({ where: { contentItemId: item.id, kind: 'subtitle' } })
  if (storyboard && !hasSubtitle) {
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

  // BGM 和配音一起定下来,审批时能连着旁白一起试听
  const mood = pickBgmMood({
    bgmMood: storyboard?.bgmMood,
    coverTemplate: item.coverTemplate,
    category: item.topic?.category,
  })
  const bgm = await ensureBgmAsset(item.id, mood, script.durationEstSec)

  return { chars: script.fullText.length, bgmMood: mood, bgm: bgm?.path ?? null }
}

async function runCompose(item: ItemWithRelations) {
  const storyboard = item.storyboards[0]
  const voiceover = item.assets.find((a) => a.kind === 'voiceover') ??
    (await prisma.asset.findFirst({ where: { contentItemId: item.id, kind: 'voiceover' } }))
  if (!storyboard || !voiceover) throw new Error('缺少分镜或配音,无法合成')

  // 已经有真成片了(外部 worker 交过货),直接过
  const done = item.assets.find((a) => a.kind === 'final_video' && !a.isMock)
  if (done) return { path: done.path, composedBy: 'worker' }

  // COMPOSE_MODE=worker:合成交给自托管的 FFmpeg worker。
  // 它会 12 张图 + 3 段视频 + 旁白 + BGM 烧成一条 90 秒竖屏片,几分钟起步,
  // 既超 serverless 函数上限也没有 FFmpeg 可用,所以这里只等,不干活。
  if (process.env.COMPOSE_MODE === 'worker') {
    return { waitingForWorker: true, stayInStage: true }
  }

  const bgm = item.assets.find((a) => a.kind === 'bgm')
  const providers = getMediaProviders()
  const final = await providers.compose.compose({
    itemId: item.id,
    shots: storyboard.shots as unknown as unknown[],
    voiceoverPath: voiceover.path,
    bgmPath: bgm?.path,
  })
  await prisma.asset.create({
    data: { contentItemId: item.id, kind: 'final_video', provider: final.isMock ? 'mock' : 'remotion', path: final.path, meta: final.meta as object, isMock: final.isMock },
  })
  return { path: final.path }
}

/** 质检不通过时最多返工几次(每次带着质检意见重写脚本) */
const MAX_SCRIPT_REVISIONS = 2

/** 中文口播实测语速。用 MiniMax 默认语速念,约 4.5 字/秒 */
export const CHARS_PER_SEC = Number(process.env.SCRIPT_CHARS_PER_SEC || 4.5)
/**
 * 判不合格的硬上限。目标仍然是 60-100 秒,提示词里也照这个要求写,
 * 但卡死在 100 秒会出问题:实测模型压到 105 秒左右就下不去了,
 * 一条内容反复返工到耗尽次数、彻底卡在质检阶段——为 5% 的超长把整条毙掉不划算。
 */
const HARD_MAX_SEC = Number(process.env.SCRIPT_HARD_MAX_SEC || 110)

/** 只数正文字数,标点和空白不占时间 */
export function scriptChars(fullText: string) {
  return fullText.replace(/[\s,，。!！?？;；、:：""''()()《》—…·]/g, '').length
}

export function estimateDurationSec(fullText: string) {
  return Math.round(scriptChars(fullText) / CHARS_PER_SEC)
}

/** 超出 60-100 秒就返回一句可执行的返工意见,合规才返回 null */
function scriptLengthIssue(fullText: string): string | null {
  const chars = scriptChars(fullText)
  const sec = estimateDurationSec(fullText)
  if (sec > HARD_MAX_SEC) {
    const target = Math.round(90 * CHARS_PER_SEC)
    return `全文${chars}字,按4.5字/秒念出来约${sec}秒,超出上限。请压缩到${target}字以内:删掉重复论证和铺垫,保留钩子、原理、案例、行动这四件事。`
  }
  if (sec < 55) {
    const target = Math.round(70 * CHARS_PER_SEC)
    return `全文${chars}字,约${sec}秒,不足60秒。请补到${target}字左右:把原理讲透一层,或补一个研究资料里有来源的细节。`
  }
  return null
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

  // 时长不交给模型判断——它报的 durationEstSec 和实际念出来的差得远(实测一条
  // 581 字的稿子自报 92 秒,配音出来 126 秒)。字数是唯一算得准的,超了就退回重写。
  const lengthIssue = scriptLengthIssue(script.fullText)
  if (lengthIssue) {
    report.passed = false
    report.durationOk = false
    report.complianceIssues = [...(report.complianceIssues ?? []), lengthIssue]
  }

  await prisma.script.update({
    where: { id: script.id },
    data: { qcReport: report as unknown as object, status: report.passed ? 'passed_qc' : 'failed_qc' },
  })
  if (report.passed) return { passed: true, version: script.version }

  const issues = [report.notes, ...report.typos, ...report.complianceIssues].filter(Boolean).join('\n- ')

  // 已经返工到上限:停在 qc,交给人工处理(看板会显示质检意见)
  if (script.version > MAX_SCRIPT_REVISIONS) {
    throw new Error(`质检连续${script.version}次未通过,需人工介入:${issues}`)
  }

  // 带着质检意见重写脚本,下一次 advance 会对新版本重新质检
  if (!item.research) throw new Error('缺少研究资料,无法返工')
  const revised = await generateJSON<ScriptOutput>({
    system: SCRIPTWRITER_SYSTEM,
    user:
      scriptwriterUser(item.title, {
        core_claim: item.research.coreClaim,
        supporting_facts: item.research.supportingFacts,
        usable_examples: item.research.usableExamples,
        risk_notes: item.research.riskNotes,
      }) +
      `\n\n上一版脚本没有通过质检,必须修正以下问题后重写(不要重复同样的错误):\n- ${issues}\n\n` +
      `特别注意:案例里的品类、价格、数字必须来自上面的研究资料;资料里没有的,改成泛化表述或直接换成资料里有的例子,不要自己编。`,
    maxTokens: 4096,
    mockKey: 'script',
    mockParams: { title: item.title },
  })
  await prisma.script.create({
    data: {
      contentItemId: item.id,
      version: script.version + 1,
      beats: revised.beats as unknown as object,
      fullText: revised.fullText,
      durationEstSec: estimateDurationSec(revised.fullText),
    },
  })
  await prisma.contentItem.update({
    where: { id: item.id },
    data: {
      coverTitleLines: revised.coverTitleLines?.slice(0, 3) ?? item.coverTitleLines,
      coverTemplate: ['truth', 'counter', 'control'].includes(revised.coverTemplate) ? revised.coverTemplate : item.coverTemplate,
    },
  })
  // 停在 qc 阶段,下一次 advance 会质检新版本(不算失败,n8n 循环继续)
  return { passed: false, stayInStage: true, revisedTo: script.version + 1, issues }
}

const HANDLERS: Record<Stage, (item: ItemWithRelations, budgetMs?: number) => Promise<Record<string, unknown>>> = {
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
export async function advanceItem(itemId: string, opts: { budgetMs?: number } = {}) {
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
    const detail = await HANDLERS[stage](item, opts.budgetMs)

    // 阶段要求留在原地(如质检返工:已重写脚本,下一次 advance 复检新版本)
    if (detail.stayInStage) {
      await prisma.contentItem.update({ where: { id: itemId }, data: { stageEnteredAt: new Date() } })
      await logEvent({ contentItemId: itemId, stage, status: 'succeeded', detail })
      return { itemId, stage, done: false, retried: true, detail }
    }

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
