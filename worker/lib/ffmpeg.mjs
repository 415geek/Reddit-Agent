import { spawn } from 'node:child_process'

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe'

export function run(bin, args, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args)
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => {
      err += d
      // 只留最后 8000 字符,ffmpeg 的进度输出很啰嗦
      if (err.length > 8000) err = err.slice(-8000)
      if (!quiet) process.stderr.write(d)
    })
    p.on('error', reject)
    p.on('close', (code) => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(`${bin} 退出码 ${code}\n${err.slice(-2000)}`))
    })
  })
}

export const ffmpeg = (args, opts) => run(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args], opts)

/**
 * 跑 ffmpeg 并把 stderr 收回来。
 * silencedetect 这类分析滤镜的结果是写在 stderr 上的,run() 只给 stdout,拿不到。
 */
export function ffmpegStderr(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-nostdin', ...args])
    let err = ''
    p.stdout.resume()
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    // 分析用的调用即使非零退出也把已经拿到的内容交出去,由调用方判断
    p.on('close', () => resolve(err))
  })
}

/** 读时长(秒)。读不到返回 0 */
export async function probeDuration(file) {
  try {
    const out = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
    const d = Number(out)
    return Number.isFinite(d) ? d : 0
  } catch {
    return 0
  }
}

export async function assertFfmpeg() {
  await run(FFMPEG, ['-version'])
  await run(FFPROBE, ['-version'])
}
