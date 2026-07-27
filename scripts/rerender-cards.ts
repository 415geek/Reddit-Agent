/**
 * 用库里已有的配图重渲一遍卡片。改了版式或文案规范化之后用,
 * 不重新调生图接口——那部分是花钱的,版式迭代不该跟着一起烧。
 * 用法:npx tsx --tsconfig tsconfig.scripts.json scripts/rerender-cards.ts <itemId> <输出目录>
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { renderCardPng } from '../lib/cards/render'
import { saveAsset } from '../lib/storage'
import { NoteCard } from '../lib/domain'

async function main() {
  const [itemId, outDir] = process.argv.slice(2)
  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    include: { notes: { orderBy: { version: 'desc' }, take: 1 }, assets: true },
  })
  if (!item?.notes[0]) throw new Error('找不到笔记')
  const cards = item.notes[0].cards as unknown as NoteCard[]
  const imgs = new Map(item.assets.filter((a) => a.kind === 'card_image').map((a) => [a.shotIndex, a.path]))

  await fs.mkdir(outDir, { recursive: true })
  for (const c of cards) {
    const png = await renderCardPng({
      label: c.label,
      titleTop: c.titleTop,
      titleBottom: c.titleBottom,
      body: c.body,
      bullets: c.bullets,
      imagePath: imgs.get(c.idx === 0 ? 1 : c.idx) ?? null,
      pageNo: c.idx + 1,
      pageTotal: cards.length,
    })
    await saveAsset(`items/${item.id}/card_final_${c.idx}.png`, png)
    await fs.writeFile(path.join(outDir, `card_${String(c.idx).padStart(2, '0')}.png`), png)
  }
  console.log(`重渲 ${cards.length} 张 → ${outDir}`)
  await prisma.$disconnect()
}
main()
