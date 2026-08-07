/**
 * 逐个实拉白名单里的源,报告能不能用。
 * 加新源之前先跑这个:npm run feeds:check
 *
 * 光看 HTTP 200 不够——不少站点 404 页也返回 200,或者返回的是 HTML 不是 RSS,
 * 所以这里一定要真的解析出条目、并且看一眼标题像不像话。
 */
import { SOURCE_FEEDS } from '../lib/sources/feeds'
import { fetchFeed } from '../lib/sources/fetch'

async function main() {
  const only = process.argv[2]
  const feeds = only ? SOURCE_FEEDS.filter((f) => f.slug === only) : SOURCE_FEEDS
  let bad = 0

  for (const feed of feeds) {
    process.stdout.write(`${feed.slug.padEnd(28)} `)
    try {
      const items = await fetchFeed(feed)
      const withDate = items.filter((i) => i.publishedAt).length
      const withSummary = items.filter((i) => i.summary).length
      if (!items.length) {
        bad++
        console.log('✗ 拉到 0 条')
        continue
      }
      const newest = items
        .map((i) => i.publishedAt)
        .filter(Boolean)
        .sort((a, b) => b!.getTime() - a!.getTime())[0]
      console.log(
        `✓ ${String(items.length).padStart(3)} 条 · 带日期 ${withDate} · 带摘要 ${withSummary}` +
          (newest ? ` · 最新 ${newest.toISOString().slice(0, 10)}` : ''),
      )
      console.log(`   └ ${items[0].title.slice(0, 88)}`)
    } catch (e) {
      bad++
      console.log(`✗ ${String(e).slice(0, 90)}`)
    }
  }

  console.log(`\n${feeds.length - bad}/${feeds.length} 个源可用`)
  if (bad) process.exitCode = 1
}

main()
