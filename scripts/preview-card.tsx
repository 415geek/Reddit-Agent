/**
 * 离线渲染几张样卡,肉眼比对版式对不对。
 * 用法:npx tsx scripts/preview-card.tsx [输出目录]
 *
 * 文案直接抄现有账号已经发过的几条,这样比出来的是"版式像不像",
 * 不会被新写的文案好坏干扰。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { CardLayout } from '../lib/cards/layout'
import { loadCardFonts } from '../lib/cards/fonts'
import { CARD_HEIGHT, CARD_WIDTH } from '../lib/domain'

const SAMPLES = [
  {
    label: '消费者心理 · 时段',
    titleTop: '晚市在变早',
    titleBottom: '4点档涨13%',
    body: 'OpenTable:下午 4 点档用餐一年涨 13%。客人把晚饭往前挪,你 4-6 点的空桌就是白扔的房租。附一张早鸟档搭建清单。',
    pageNo: 1,
    pageTotal: 5,
  },
  {
    label: '算账 · Dual Pricing',
    titleTop: '收卡费的店',
    titleBottom: '八成收错了',
    body: 'surcharge、现金折扣、双重定价是三回事。一张 5 步合规对照表,把 2.5% 手续费拿回来,还不挨差评。',
    pageNo: 1,
    pageTotal: 5,
  },
  {
    label: '餐饮运营 · 后厨标准化',
    titleTop: '最贵的不是厨师',
    titleBottom: '是没有标准',
    body: '厨师缺口 300 万、连锁人力成本降 40%。上炒菜机前,先做完这 5 步标准化。',
    bullets: ['先量出每道菜的出餐时长', '把调味拆成克数不是"适量"', '半成品和现做分线', '新人上岗只看图不看人'],
    pageNo: 3,
    pageTotal: 6,
  },
  {
    label: '消费者心理 · 小费荒',
    titleTop: '35% 的客人',
    titleBottom: '开始砍小费',
    body: 'Popmenu 2026:44% 的人小费给得比去年少。一张小费页自查表,POS 十分钟改完。',
    pageNo: 1,
    pageTotal: 6,
  },
]

async function main() {
  const outDir = process.argv[2] || path.join(process.cwd(), 'card-preview')
  await fs.mkdir(outDir, { recursive: true })
  const fonts = await loadCardFonts()

  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i]
    const res = new ImageResponse(CardLayout({ ...s, imageSrc: null }), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
    })
    const buf = Buffer.from(await res.arrayBuffer())
    const file = path.join(outDir, `card_${i}.png`)
    await fs.writeFile(file, buf)
    console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB`)
  }
}

main()
