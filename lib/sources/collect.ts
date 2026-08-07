import { prisma } from '../prisma'
import { SOURCE_FEEDS, type FeedDef } from './feeds'
import { fetchFeed } from './fetch'

/**
 * 每日采集:把白名单里的源拉一遍,新素材落库。
 *
 * 只做"搬进来"这一件事,不做筛选也不做判断——挑什么、写什么是后面选题那一步的活。
 * 这样分开是因为采集要便宜且可以经常跑,而选题要花模型的钱。
 */

/**
 * 素材保鲜期,按类别分开算。
 *
 * 一开始所有源都用 14 天,结果法规那一路只剩 2 条——联邦公报 40 条里 38 条被当成"太老"扔了。
 * 这是个判断错误:行业新闻过一周就没人看了,但一条工资工时规则从提出到生效要走几个月,
 * 老板真正需要知道的往往是三个月前发布、下个月开始执行的那一条。
 * 政策法规按新闻的保鲜期去砍,等于把这个号最能打的品类砍没了。
 */
const MAX_AGE_DAYS: Record<string, number> = {
  regulation: 120,
  policy: 90,
  report: 45,
  data: 45,
  trend: 21,
  media: 14,
}
const DEFAULT_MAX_AGE_DAYS = Number(process.env.SOURCE_MAX_AGE_DAYS || 14)

/** 单个源一次最多收几条,防止某个源刷屏把别的挤没 */
const PER_FEED_LIMIT = Number(process.env.SOURCE_PER_FEED_LIMIT || 25)

/**
 * 一眼就知道不可能成为选题的标题。
 * 联邦公报里大量是"征求意见""信息收集活动"这类纯流程公告,
 * 它们占着法规那一路的名额,但没有任何可讲的内容。
 */
const NOISE_PATTERNS = [
  /Agency Information Collection Activities/i,
  /Comment Request;\s*Information Collection/i,
  /Sunshine Act Meeting/i,
  /Notice of Meeting/i,
  /Privacy Act of 1974/i,
]

function isNoise(title: string) {
  return NOISE_PATTERNS.some((re) => re.test(title))
}

export interface CollectResult {
  feeds: number
  fetched: number
  inserted: number
  duplicates: number
  tooOld: number
  noise: number
  errors: Array<{ slug: string; error: string }>
}

/** 把白名单同步进库。改了 config 里的名字/权重,下一次采集就会跟着更新 */
export async function syncFeeds(): Promise<number> {
  for (const f of SOURCE_FEEDS) {
    await prisma.sourceFeed.upsert({
      where: { slug: f.slug },
      update: { name: f.name, url: f.url, kind: f.kind, category: f.category, region: f.region, weight: f.weight },
      create: {
        slug: f.slug,
        name: f.name,
        url: f.url,
        kind: f.kind,
        category: f.category,
        region: f.region,
        weight: f.weight,
      },
    })
  }
  // config 里删掉的源停用而不是删除:SourceItem 还挂在上面,删了会把历史素材的出处弄丢
  const slugs = SOURCE_FEEDS.map((f) => f.slug)
  await prisma.sourceFeed.updateMany({ where: { slug: { notIn: slugs } }, data: { active: false } })
  return SOURCE_FEEDS.length
}

async function collectOne(feed: FeedDef, result: CollectResult) {
  const days = MAX_AGE_DAYS[feed.category] ?? DEFAULT_MAX_AGE_DAYS
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000)
  const row = await prisma.sourceFeed.findUnique({ where: { slug: feed.slug } })
  if (!row) return

  let items
  try {
    items = await fetchFeed(feed)
  } catch (e) {
    result.errors.push({ slug: feed.slug, error: String(e).slice(0, 300) })
    await prisma.sourceFeed.update({
      where: { id: row.id },
      data: { lastFetchedAt: new Date(), lastError: String(e).slice(0, 500) },
    })
    return
  }

  result.fetched += items.length

  const fresh = []
  for (const item of items) {
    if (fresh.length >= PER_FEED_LIMIT) break
    // 没有日期的当新的收,总比因为源不给日期就整个源用不了强
    if (item.publishedAt && item.publishedAt < cutoff) {
      result.tooOld++
      continue
    }
    if (isNoise(item.title)) {
      result.noise++
      continue
    }
    fresh.push({
      feedId: row.id,
      fingerprint: item.fingerprint,
      url: item.url,
      title: item.title,
      source: feed.name,
      category: feed.category,
      region: feed.region,
      publishedAt: item.publishedAt,
      summary: item.summary,
    })
  }

  // 一次性插入并跳过重复。每天拉的是同一批 feed,绝大多数条目上一轮就已经采过了,
  // 所以"撞了"是常态不是错误——逐条 insert 再 catch 唯一键冲突的话,
  // 每轮会白跑几百次往返,而且 Prisma 会把每一次冲突都打到 stderr 上,
  // 真出问题的时候反而被这些噪音淹掉。
  if (fresh.length) {
    const { count } = await prisma.sourceItem.createMany({ data: fresh, skipDuplicates: true })
    result.inserted += count
    result.duplicates += fresh.length - count
  }

  await prisma.sourceFeed.update({
    where: { id: row.id },
    data: { lastFetchedAt: new Date(), lastError: null },
  })
}

export async function collectSources(opts: { budgetMs?: number } = {}): Promise<CollectResult> {
  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : Infinity
  const result: CollectResult = { feeds: 0, fetched: 0, inserted: 0, duplicates: 0, tooOld: 0, noise: 0, errors: [] }

  await syncFeeds()

  // 按权重从高到低采:预算不够时,先保住政府和协会那几个源
  const feeds = [...SOURCE_FEEDS].sort((a, b) => b.weight - a.weight)

  for (const feed of feeds) {
    if (Date.now() > deadline) break
    result.feeds++
    await collectOne(feed, result)
  }

  return result
}
