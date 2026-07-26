#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { assertFfmpeg } from './lib/ffmpeg.mjs'
import { composeVideo } from './lib/compose.mjs'
import { storageBackend, uploadAsset } from './lib/storage.mjs'

/**
 * 成片合成 worker。
 *
 * 跑在自己的服务器上,不在 Vercel 上——一条 90 秒竖屏成片要拼十几段画面、
 * 混两轨音频、烧一遍字幕,几分钟起步,而 serverless 既有函数时长上限
 * 也没有 FFmpeg。所以这里主动去应用那边领任务,做完把成片直传存储。
 *
 * 必填 env:
 *   FACTORY_APP_URL      应用地址,如 https://bizbrain-c8geek.vercel.app
 *   N8N_WEBHOOK_SECRET   和应用同一个,用来领任务/交货
 *   SUPABASE_URL/KEY     应用用 Supabase Storage 时必须同样配置(否则成片存到本地应用读不到)
 * 可选:
 *   POLL_INTERVAL_MS(默认 30000)、WORKER_ID、BGM_GAIN_DB(默认 -20)、
 *   BURN_SUBTITLES=false 关字幕、SUBTITLE_FONT、VIDEO_PRESET、ONCE=1 只跑一轮
 */

const APP_URL = (process.env.FACTORY_APP_URL || '').replace(/\/$/, '')
const SECRET = process.env.N8N_WEBHOOK_SECRET || ''
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30_000)
const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`
const ONCE = process.env.ONCE === '1'

const log = (...a) => console.log(new Date().toISOString(), '[compose]', ...a)

function requireEnv() {
  const missing = []
  if (!APP_URL) missing.push('FACTORY_APP_URL')
  if (!SECRET) missing.push('N8N_WEBHOOK_SECRET')
  if (missing.length) {
    console.error(`缺少环境变量: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function api(pathname, init = {}) {
  const res = await fetch(`${APP_URL}${pathname}`, {
    ...init,
    headers: { 'x-webhook-secret': SECRET, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${text.slice(0, 400)}`)
  return JSON.parse(text)
}

/** 素材从应用的 /api/assets 取,带 token(和 n8n 用的是同一个 secret) */
async function fetchAsset(relPath, destFile) {
  const url = `${APP_URL}/api/assets/${relPath}?token=${encodeURIComponent(SECRET)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`取素材失败 ${res.status}: ${relPath}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destFile, buf)
  return destFile
}

/** 占位素材(mock 阶段留下的 .txt/.svg)不能进合成,这里直接排除 */
const USABLE = /\.(png|jpg|jpeg|webp|mp4|mov|webm|mp3|wav|m4a)$/i

function makeDownloader(job) {
  return async (dir) => {
    const files = { shotImages: {}, motionClips: {}, voiceover: null, bgm: null }

    for (const shot of job.shots) {
      if (shot.imagePath && USABLE.test(shot.imagePath)) {
        const ext = path.extname(shot.imagePath) || '.png'
        files.shotImages[shot.idx] = await fetchAsset(shot.imagePath, path.join(dir, `shot_${shot.idx}${ext}`))
      }
      if (shot.motionPath && USABLE.test(shot.motionPath)) {
        const ext = path.extname(shot.motionPath) || '.mp4'
        files.motionClips[shot.idx] = await fetchAsset(shot.motionPath, path.join(dir, `motion_${shot.idx}${ext}`))
      }
    }

    if (job.voiceoverPath && USABLE.test(job.voiceoverPath)) {
      const ext = path.extname(job.voiceoverPath) || '.mp3'
      files.voiceover = await fetchAsset(job.voiceoverPath, path.join(dir, `voiceover${ext}`))
    }
    if (job.bgmPath && USABLE.test(job.bgmPath)) {
      const ext = path.extname(job.bgmPath) || '.wav'
      try {
        files.bgm = await fetchAsset(job.bgmPath, path.join(dir, `bgm${ext}`))
      } catch (e) {
        // BGM 拿不到不该拖垮整条片子,退回只有旁白
        log(`BGM 取不到(${e.message}),这条按无配乐合成`)
      }
    }
    return files
  }
}

async function handleJob(job) {
  log(`领到任务 ${job.itemId} 《${job.title}》 ${job.shots.length}镜头 BGM=${job.bgmPath ? `${job.bgmMood || '?'} ${job.bgmPath}` : '无'}`)
  const started = Date.now()
  let result
  try {
    result = await composeVideo(job, { downloadTo: makeDownloader(job), log: (m) => log(' ', m) })
  } catch (e) {
    log(`合成失败 ${job.itemId}: ${e.message}`)
    await api(`/api/pipeline/compose/${job.itemId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ error: e.message }),
    }).catch((err) => log(`报错回传也失败了: ${err.message}`))
    return
  }

  try {
    const rel = `items/${job.itemId}/final.mp4`
    await uploadAsset(rel, result.buffer, 'video/mp4')
    const meta = { ...result.meta, workerId: WORKER_ID, composeSec: Math.round((Date.now() - started) / 1000) }
    const done = await api(`/api/pipeline/compose/${job.itemId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ path: rel, meta }),
    })
    log(`完成 ${job.itemId}:${(result.buffer.length / 1e6).toFixed(1)}MB / ${meta.durationSec}s / 用时 ${meta.composeSec}s → ${done.stage || '已登记'}`)
  } finally {
    await result.cleanup().catch(() => {})
  }
}

async function tick() {
  const { job } = await api(`/api/pipeline/compose/next?worker=${encodeURIComponent(WORKER_ID)}`)
  if (!job) return false
  await handleJob(job)
  return true
}

async function main() {
  requireEnv()
  await assertFfmpeg()
  log(`启动 worker=${WORKER_ID} app=${APP_URL} 存储=${storageBackend()} 轮询=${POLL_INTERVAL_MS}ms`)

  if (ONCE) {
    const did = await tick()
    log(did ? '单次任务结束' : '队列为空')
    return
  }

  let stopping = false
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      log(`收到 ${sig},做完当前任务后退出`)
      stopping = true
    })
  }

  while (!stopping) {
    try {
      // 有活就接着做下一条,没活才睡
      const did = await tick()
      if (!did && !stopping) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    } catch (e) {
      log(`轮询出错: ${e.message}`)
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  }
  log('已退出')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
