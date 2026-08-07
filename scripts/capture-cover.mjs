#!/usr/bin/env node
// 封面截图:用 Playwright 打开 /covers/<itemId>?token=... 截 1080×1920 PNG。
// 用法:node scripts/capture-cover.mjs <itemId> [输出路径]
// 依赖:playwright-core + 本机 Chromium(环境变量 CHROMIUM_PATH 或 PLAYWRIGHT_BROWSERS_PATH)
// VPS 上可在 crontab/n8n Execute Command 节点里调用;mock 阶段不截图也不影响流程。

import { chromium } from 'playwright-core'

const [itemId, outPath] = process.argv.slice(2)
if (!itemId) {
  console.error('用法: node scripts/capture-cover.mjs <itemId> [out.png]')
  process.exit(1)
}

const appUrl = process.env.FACTORY_APP_URL || 'http://localhost:3031'
const token = process.env.N8N_WEBHOOK_SECRET
if (!token) {
  console.error('需要 N8N_WEBHOOK_SECRET 环境变量(封面页鉴权)')
  process.exit(1)
}

const executablePath =
  process.env.CHROMIUM_PATH ||
  (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined)

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await page.goto(`${appUrl}/covers/${itemId}?token=${token}`, { waitUntil: 'networkidle' })
const out = outPath || `cover_${itemId}.png`
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1920 } })
await browser.close()
console.log(`封面已保存: ${out}`)
