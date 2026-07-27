/**
 * 端到端跑一条图文:采集 → 选题 → 核实 → 写稿 → 质检 → 出图渲卡。
 * 用法:npx tsx --tsconfig tsconfig.scripts.json scripts/note-e2e.ts [导出目录]
 *
 * 真调 Claude 和 Gemini,会花钱。跑之前确认 .env 里的 key 都在。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { collectSources } from '../lib/sources/collect'
import { pickNoteTopics, queueNoteTopics } from '../lib/agents/note-topics'
import { advanceNoteItem } from '../lib/agents/note-pipeline'
import { readAsset } from '../lib/storage'
import { NoteCard } from '../lib/domain'

const OUT = process.argv[2] || path.join(process.cwd(), 'note-out')

async function main() {
  const t0 = Date.now()

  const have = await prisma.sourceItem.count({ where: { status: 'new' } })
  if (have < 20) {
    console.log('素材不够,先采集一轮…')
    console.log('  ', JSON.stringify(await collectSources({ budgetMs: 180_000 })))
  } else {
    console.log(`素材池里有 ${have} 条待挑`)
  }

  console.log('\n── 选题')
  console.log('  ', JSON.stringify(await pickNoteTopics(2)))

  const items = await queueNoteTopics(1)
  if (!items.length) throw new Error('没有可排产的选题')
  const itemId = items[0].id
  console.log(`  排产:${items[0].title}`)

  console.log('\n── 推进')
  for (let i = 0; i < 12; i++) {
    const before = await prisma.contentItem.findUnique({ where: { id: itemId }, select: { stage: true } })
    if (!before || before.stage === 'awaiting_approval') break
    const out = await advanceNoteItem(itemId, { budgetMs: 240_000 })
    console.log(`  ${before.stage} → ${out.stage}  ${JSON.stringify(out.detail ?? {}).slice(0, 170)}`)
    if (out.done) break
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    include: { notes: { orderBy: { version: 'desc' }, take: 1 }, assets: true, topic: { include: { sourceItem: true } } },
  })
  if (!item?.notes[0]) throw new Error('没有产出笔记')
  const note = item.notes[0]

  await fs.mkdir(OUT, { recursive: true })
  const finals = item.assets.filter((a) => a.kind === 'card_final').sort((a, b) => (a.shotIndex ?? 0) - (b.shotIndex ?? 0))
  for (const a of finals) {
    await fs.writeFile(path.join(OUT, `card_${String(a.shotIndex).padStart(2, '0')}.png`), await readAsset(a.path))
  }

  const cards = note.cards as unknown as NoteCard[]
  const txt = [
    `原始素材:${item.topic.sourceItem?.title ?? '(无)'}`,
    `来源:${item.topic.sourceItem?.source ?? '-'}  ${item.topic.sourceItem?.url ?? ''}`,
    '',
    `【feed 标题】${note.noteTitle}`,
    '',
    '【正文】',
    note.bodyText,
    '',
    `【话题】${note.hashtags.map((h) => '#' + h).join(' ')}`,
    '',
    '【卡片】',
    ...cards.map(
      (c) =>
        `  ${String(c.idx + 1).padStart(2, '0')}. [${c.label}] ${c.titleTop} / ${c.titleBottom}\n` +
        `      ${c.body}` +
        (c.bullets?.length ? '\n      · ' + c.bullets.join('\n      · ') : ''),
    ),
    '',
    '【来源】',
    JSON.stringify(note.sources, null, 2),
    '',
    '【质检】',
    JSON.stringify(note.qcReport, null, 2),
  ].join('\n')
  await fs.writeFile(path.join(OUT, 'note.txt'), txt, 'utf-8')

  console.log(`\n── 完成,用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  console.log(`   卡片 ${finals.length} 张 → ${OUT}`)
  console.log(`   文案 → ${path.join(OUT, 'note.txt')}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('失败:', e)
  await prisma.$disconnect()
  process.exit(1)
})
