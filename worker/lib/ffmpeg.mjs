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
