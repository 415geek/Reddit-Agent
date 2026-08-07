import { prisma } from '../prisma'
import { Shot } from '../domain'
import { logEvent } from './events'
import { advanceItem } from './pipeline'

/**
 * 合成任务队列:Vercel 上的应用只排队,真正的 FFmpeg 合成由自托管 worker 领任务去做。
 * 为什么不在应用里合成:一条 90 秒竖屏片要拼 12 张图 + 3 段视频 + 混两轨音频,
 * 几分钟起步,serverless 有函数时长上限、没有 FFmpeg、也没有临时大磁盘。
 */

/** 认领有效期。worker 崩了或机器被回收,超过这个时间任务自动回到池子里 */
const CLAIM_TTL_MS = Number(process.env.COMPOSE_CLAIM_TTL_MS || 25 * 60 * 1000)

const claimKey = (itemId: string) => `compose:claim:${itemId}`

export interface ComposeShot {
  idx: number
  type: 'image' | 'motion'
  durationSec: number
  /** push_in | pan | depth | particles | glow —— 静态图靠它做运镜,否则整条片子是幻灯片 */
  cameraMove: string
  narration: string
  /** 相对资产路径;worker 用 /api/assets/<path>?token=… 取 */
  imagePath: string | null
  motionPath: string | null
}

export interface ComposeJob {
  itemId: string
  title: string
  durationEstSec: number
  bgmMood: string | null
  /** 反转点镜头下标:合成时在这里做节奏断点 */
  turnShotIdx: number | null
  shots: ComposeShot[]
  voiceoverPath: string
  bgmPath: string | null
  subtitlePath: string | null
}

/**
 * 领一个待合成的任务。没有就返回 null。
 * 认领用 Setting 行做轻量锁——合成任务一天几十条,不值得为它加一张表。
 */
export async function claimComposeJob(workerId: string): Promise<ComposeJob | null> {
  const candidates = await prisma.contentItem.findMany({
    where: { stage: 'compose' },
    include: {
      storyboards: { orderBy: { version: 'desc' }, take: 1 },
      assets: true,
    },
    orderBy: { stageEnteredAt: 'asc' },
    take: 20,
  })

  const now = Date.now()
  for (const item of candidates) {
    // 已经有真成片的不用再做
    if (item.assets.some((a) => a.kind === 'final_video' && !a.isMock)) continue

    const lock = await prisma.setting.findUnique({ where: { key: claimKey(item.id) } })
    const claimedAt = (lock?.value as { at?: number } | null)?.at ?? 0
    if (claimedAt && now - claimedAt < CLAIM_TTL_MS) continue

    const storyboard = item.storyboards[0]
    const voiceover = item.assets.find((a) => a.kind === 'voiceover')
    if (!storyboard || !voiceover) continue

    const shots = storyboard.shots as unknown as Shot[]
    const byShot = new Map<number, { image?: string; motion?: string }>()
    for (const a of item.assets) {
      if (a.shotIndex == null) continue
      const e = byShot.get(a.shotIndex) ?? {}
      if (a.kind === 'shot_image') e.image = a.path
      if (a.kind === 'motion_clip' && !a.isMock) e.motion = a.path
      byShot.set(a.shotIndex, e)
    }

    const bgm = item.assets.find((a) => a.kind === 'bgm')
    // 分镜里没记情绪(老数据)就用选曲时落在 asset 上的那个
    const bgmMood = storyboard.bgmMood ?? ((bgm?.meta as { mood?: string } | null)?.mood ?? null)

    const value = { at: now, workerId }
    await prisma.setting.upsert({
      where: { key: claimKey(item.id) },
      update: { value },
      create: { key: claimKey(item.id), value },
    })
    await logEvent({ contentItemId: item.id, stage: 'compose', status: 'started', detail: { workerId } })

    return {
      itemId: item.id,
      title: item.title,
      durationEstSec: shots.reduce((s, sh) => s + (sh.durationSec || 0), 0),
      bgmMood,
      turnShotIdx: storyboard.turnShotIdx,
      shots: shots.map((sh) => ({
        idx: sh.idx,
        type: sh.type,
        durationSec: sh.durationSec,
        cameraMove: sh.cameraMove || 'push_in',
        narration: sh.narration,
        imagePath: byShot.get(sh.idx)?.image ?? null,
        motionPath: byShot.get(sh.idx)?.motion ?? null,
      })),
      voiceoverPath: voiceover.path,
      bgmPath: bgm?.path ?? null,
      subtitlePath: item.assets.find((a) => a.kind === 'subtitle')?.path ?? null,
    }
  }
  return null
}

/** worker 交货:成片已由 worker 直传存储,这里只登记路径并推进阶段 */
export async function completeComposeJob(itemId: string, path: string, meta: Record<string, unknown>) {
  const item = await prisma.contentItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error(`ContentItem 不存在: ${itemId}`)

  // 占位成片(final.mp4.txt)清掉,免得审批页同时出现两个"成片"
  await prisma.asset.deleteMany({ where: { contentItemId: itemId, kind: 'final_video' } })
  await prisma.asset.create({
    data: { contentItemId: itemId, kind: 'final_video', provider: 'ffmpeg', path, meta: meta as object, isMock: false },
  })
  await prisma.setting.deleteMany({ where: { key: claimKey(itemId) } })

  // 还停在 compose 就推一把:runCompose 见到真成片会直接放行到审批队列
  if (item.stage === 'compose') return advanceItem(itemId)
  return { itemId, stage: item.stage, done: true, note: '成片已登记(该内容已不在合成阶段)' }
}

/** worker 报错:释放认领,让任务回到池子里等下一轮 */
export async function failComposeJob(itemId: string, error: string) {
  await prisma.setting.deleteMany({ where: { key: claimKey(itemId) } })
  await logEvent({ contentItemId: itemId, stage: 'compose', status: 'failed', error: error.slice(0, 2000) })
}
