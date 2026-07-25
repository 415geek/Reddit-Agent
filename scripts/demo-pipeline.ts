/**
 * 端到端演示:AI_MOCK=1 MEDIA_PROVIDER=mock npx tsx scripts/demo-pipeline.ts
 * 走完整链路:生成选题 → 入队 → 逐阶段推进 → 审批 → 登记发布 → 录入数据 → 复盘。
 * 需要 DATABASE_URL 指向已迁移的数据库。
 */
import { prisma } from '../lib/prisma'
import { generateAndScoreTopics, queueTopTopics } from '../lib/agents/topics'
import { advanceItem, decideApproval } from '../lib/agents/pipeline'
import { runRetrospective } from '../lib/agents/retrospective'

async function main() {
  console.log('== 1. 选题生成 + 评分 + 风险淘汰 ==')
  const gen = await generateAndScoreTopics(6)
  console.log('   ', gen)

  console.log('== 2. 头部选题入队 ==')
  const items = await queueTopTopics(1)
  if (items.length === 0) throw new Error('没有达标选题可入队')
  const item = items[0]
  console.log(`    item: ${item.id} 《${item.title}》`)

  console.log('== 3. 流水线逐阶段推进 ==')
  for (let i = 0; i < 10; i++) {
    const r = await advanceItem(item.id)
    console.log(`    → ${r.stage}`, r.detail ?? '')
    if (r.done) break
  }

  console.log('== 4. 网页审批:批准 ==')
  await decideApproval(item.id, 'approved', 'web', 'demo', 'admin')

  console.log('== 5. 人工发布登记(Phase 1) ==')
  const updated = await prisma.contentItem.update({ where: { id: item.id }, data: { stage: 'published' } })
  const pub = await prisma.publication.create({
    data: { contentItemId: item.id, mode: 'manual', shareUrl: 'https://v.douyin.com/demo123/' },
  })
  await prisma.topic.update({ where: { id: updated.topicId }, data: { status: 'published' } })
  console.log(`    publication: ${pub.id}`)

  console.log('== 6. 录入 24h 数据快照 ==')
  await prisma.metricSnapshot.create({
    data: {
      publicationId: pub.id,
      atHours: 24,
      plays: 15000,
      completionRate: 0.42,
      likes: 620,
      favorites: 210,
      shares: 95,
      comments: 48,
      followersDelta: 130,
      source: 'manual',
    },
  })

  console.log('== 7. 复盘 ==')
  const retro = await runRetrospective(7)
  console.log('   ', retro)

  console.log('== 8. 产物清单 ==')
  const assets = await prisma.asset.findMany({ where: { contentItemId: item.id }, orderBy: { createdAt: 'asc' } })
  for (const a of assets) console.log(`    [${a.kind}${a.shotIndex != null ? ` #${a.shotIndex}` : ''}] ${a.path}${a.isMock ? ' (mock)' : ''}`)

  console.log('\n✅ 全链路通过')
}

main()
  .catch((e) => {
    console.error('❌ 演示失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
