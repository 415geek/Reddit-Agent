/** 手动跑一次采集,看看今天能收到什么。npx tsx scripts/collect-once.ts */
import { collectSources } from '../lib/sources/collect'

async function main() {
  const r = await collectSources({ budgetMs: 180_000 })
  console.log(JSON.stringify(r, null, 2))
}
main()
