#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * 一次性生成 BGM 曲库。
 *
 * 为什么是曲库而不是每条视频现生成:
 * ① 一个账号的配乐保持一致才有听觉记忆,每条换一首等于每条换个乐队;
 * ② 曲库里的每一首都能先自己听一遍再用,现生成的没人听过就发出去了;
 * ③ 生成一次几毛钱,之后零成本、零等待——现生成每条要等 30-90 秒。
 *
 * 用法:
 *   FAL_KEY=... SUPABASE_URL=... SUPABASE_KEY=... \
 *   FACTORY_APP_URL=https://... N8N_WEBHOOK_SECRET=... \
 *   node scripts/build-bgm-library.mjs [每种情绪几首,默认2]
 *
 * 跑完曲子进存储的 bgm/ 目录,清单登记到应用。想换掉某首:重跑,或直接
 * 调 POST /api/admin/bgm 改清单。
 */

// 提示词和标签的真身在 config/bgm-moods.json,和应用共用一份,免得两边漂移
const CONFIG = JSON.parse(await fs.readFile(new URL('../config/bgm-moods.json', import.meta.url), 'utf-8'))
const MOODS = Object.fromEntries(Object.entries(CONFIG.moods).map(([k, v]) => [k, v.prompt]))

const PER_MOOD = Number(process.argv[2] || 2)
// 出 110 秒:比最长的成片还长一截,合成时裁掉即可,免得循环接缝被听出来
const DURATION = Number(process.env.BGM_TRACK_SEC || 110)
const MODEL = process.env.FAL_MUSIC_MODEL || 'cassetteai/music-generator'
const BUCKET = process.env.SUPABASE_BUCKET || 'assets'

const log = (...a) => console.log('[bgm]', ...a)

function need(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`缺少环境变量 ${name}`)
    process.exit(1)
  }
  return v
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args)
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${bin} 退出码 ${c}\n${err.slice(-1500)}`))))
  })
}

async function hasFfmpeg() {
  try {
    await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
}

/** 带退避的重试。曲子已经生成出来了,别让一次 503 把整轮白跑掉 */
async function retry(label, fn, times = 4) {
  let last
  for (let i = 1; i <= times; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (i === times) break
      const wait = 2000 * 2 ** (i - 1)
      log(`  ${label} 第${i}次失败(${e.message.slice(0, 80)}),${wait / 1000}秒后重试`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw last
}

async function generate(mood, prompt) {
  const url = await retry('生成', async () => {
    const res = await fetch(`https://fal.run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Key ${need('FAL_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, duration: DURATION }),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`fal ${MODEL} 失败 ${res.status}: ${text.slice(0, 300)}`)
    const out = JSON.parse(text)
    const u = out.audio_file?.url || out.audio?.url
    if (!u) throw new Error(`fal 返回里没有音频地址: ${text.slice(0, 200)}`)
    return u
  })
  // 下载单独重试:fal 的 CDN 偶尔 503,而这时曲子已经花钱生成好了
  return retry('下载', async () => {
    const audio = await fetch(url)
    if (!audio.ok) throw new Error(`下载失败 ${audio.status}`)
    return Buffer.from(await audio.arrayBuffer())
  })
}

async function upload(relPath, buffer, contentType) {
  const url = need('SUPABASE_URL').replace(/\/$/, '')
  const key = need('SUPABASE_KEY')
  await retry('上传', async () => {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${relPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': contentType, 'x-upsert': 'true' },
      body: buffer,
    })
    if (!res.ok) throw new Error(`上传失败 ${res.status}: ${(await res.text()).slice(0, 200)}`)
  })
}

async function main() {
  need('FAL_KEY')
  // 不给应用地址就只生成上传、不登记,清单打到屏幕上,之后自己 POST /api/admin/bgm
  const appUrl = (process.env.FACTORY_APP_URL || '').replace(/\/$/, '')
  const secret = process.env.N8N_WEBHOOK_SECRET || ''
  const canConvert = await hasFfmpeg()
  if (!canConvert) log('没有 ffmpeg,曲子按 wav 上传(约 17MB/首,建议装上 ffmpeg 转 mp3)')

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bb-bgm-'))
  const library = {}

  for (const [mood, prompt] of Object.entries(MOODS)) {
    library[mood] = []
    for (let i = 1; i <= PER_MOOD; i++) {
      log(`生成 ${mood}-${i} …`)
      const wav = path.join(dir, `${mood}-${i}.wav`)
      await fs.writeFile(wav, await generate(mood, prompt))

      let file = wav
      let rel = `bgm/${mood}-${i}.wav`
      let type = 'audio/wav'
      if (canConvert) {
        const mp3 = path.join(dir, `${mood}-${i}.mp3`)
        await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', mp3])
        file = mp3
        rel = `bgm/${mood}-${i}.mp3`
        type = 'audio/mpeg'
      }

      const buf = await fs.readFile(file)
      await upload(rel, buf, type)
      library[mood].push(rel)
      log(`  → ${rel} (${(buf.length / 1e6).toFixed(1)}MB)`)
    }
  }

  if (!appUrl || !secret) {
    log('未配 FACTORY_APP_URL / N8N_WEBHOOK_SECRET,跳过登记。清单如下:')
    console.log(JSON.stringify({ library }, null, 2))
    await fs.rm(dir, { recursive: true, force: true })
    return
  }

  const res = await fetch(`${appUrl}/api/admin/bgm`, {
    method: 'POST',
    headers: { 'x-webhook-secret': secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ library }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`登记曲库失败 ${res.status}: ${body.slice(0, 300)}`)
  log(`曲库已登记:${JSON.parse(body).tracks} 首`)
  log(`试听:${appUrl}/api/assets/<路径>?token=<N8N_WEBHOOK_SECRET>`)

  await fs.rm(dir, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
