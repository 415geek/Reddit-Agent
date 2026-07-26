import { BGM_MOODS, type BgmMood } from './domain'
import { prisma } from './prisma'
import { getMediaProviders, providerLabels } from './providers'

/**
 * 背景音乐的来源策略。
 *
 * library(默认,推荐)——用预先生成好的曲库,按情绪挑、轮换着用。
 *   理由有三个:①一个账号的BGM保持一致才有听觉记忆,每条都现生成等于每条换个乐队;
 *   ②曲库是人工过过耳朵的,现生成的没人听过就发出去了;③零边际成本、零等待。
 * generate——每条现生成一段。独一无二,但一次要跑 30-90 秒,
 *   超过 serverless 函数上限,只适合自托管。
 * none——不配乐,只有旁白。
 */
export type BgmMode = 'library' | 'generate' | 'none'

export function bgmMode(): BgmMode {
  const m = process.env.BGM_MODE
  if (m === 'generate' || m === 'none' || m === 'library') return m
  return 'library'
}

/** 曲库清单,由 scripts/build-bgm-library.mjs 写入 Setting 表 */
export const BGM_LIBRARY_KEY = 'bgm:library'
const BGM_ROTATION_KEY = 'bgm:rotation'

export type BgmLibrary = Partial<Record<BgmMood, string[]>>

export async function readBgmLibrary(): Promise<BgmLibrary> {
  const row = await prisma.setting.findUnique({ where: { key: BGM_LIBRARY_KEY } })
  const lib = (row?.value ?? {}) as BgmLibrary
  return lib
}

/**
 * 从曲库里挑一条。同一情绪下按轮换游标依次取,避免连着几条视频用同一首。
 * 该情绪没有曲子就退到任意有曲子的情绪,再没有就返回 null(合成时按无BGM处理)。
 */
async function pickFromLibrary(mood: BgmMood): Promise<{ path: string; mood: BgmMood } | null> {
  const lib = await readBgmLibrary()
  let use: BgmMood | null = lib[mood]?.length ? mood : null
  if (!use) use = BGM_MOODS.find((m) => lib[m]?.length) ?? null
  if (!use) return null

  const tracks = lib[use]!
  const row = await prisma.setting.findUnique({ where: { key: BGM_ROTATION_KEY } })
  const cursors = (row?.value ?? {}) as Record<string, number>
  const next = ((cursors[use] ?? -1) + 1) % tracks.length
  cursors[use] = next
  await prisma.setting.upsert({
    where: { key: BGM_ROTATION_KEY },
    update: { value: cursors },
    create: { key: BGM_ROTATION_KEY, value: cursors },
  })
  return { path: tracks[next], mood: use }
}

/**
 * 给一条内容定下BGM并落库成 asset。已经有了就直接返回,方便续跑。
 * 返回 null 表示这条片子不配乐。
 */
export async function ensureBgmAsset(itemId: string, mood: BgmMood, durationSec: number) {
  const existing = await prisma.asset.findFirst({ where: { contentItemId: itemId, kind: 'bgm' } })
  if (existing) return existing

  const mode = bgmMode()
  if (mode === 'none') return null

  if (mode === 'library') {
    const picked = await pickFromLibrary(mood)
    if (!picked) return null
    return prisma.asset.create({
      data: {
        contentItemId: itemId,
        kind: 'bgm',
        // 曲库文件是全站共用的,不复制到 items/ 目录下,直接引用
        provider: 'library',
        path: picked.path,
        meta: { mood: picked.mood, requestedMood: mood, source: 'library' },
        isMock: false,
      },
    })
  }

  const providers = getMediaProviders()
  const labels = providerLabels()
  const out = await providers.bgm.provide({ itemId, name: 'bgm', mood, durationSec })
  if (!out) return null
  return prisma.asset.create({
    data: {
      contentItemId: itemId,
      kind: 'bgm',
      provider: labels.bgm,
      path: out.path,
      meta: out.meta as object,
      isMock: out.isMock,
    },
  })
}
