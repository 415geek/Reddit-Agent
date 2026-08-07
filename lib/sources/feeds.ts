import FEEDS_CONFIG from '../../config/source-feeds.json'

/**
 * 素材源白名单。真身在 config/source-feeds.json,
 * 放 JSON 而不是 TS 是为了让检查脚本(.mjs)和应用共用同一份,不会两边漂移。
 */
export interface FeedDef {
  slug: string
  name: string
  url: string
  kind: 'rss' | 'federal_register'
  category: string
  region: string
  weight: number
  note?: string
}

export const SOURCE_FEEDS: FeedDef[] = FEEDS_CONFIG.feeds as FeedDef[]

export function findFeed(slug: string) {
  return SOURCE_FEEDS.find((f) => f.slug === slug) ?? null
}
