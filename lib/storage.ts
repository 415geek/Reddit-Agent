import fs from 'fs/promises'
import path from 'path'

/**
 * 资产存储双后端:
 * - 自托管(Docker/VPS/本地):写本地磁盘 DATA_DIR(挂 volume)
 * - Serverless(Vercel):没有持久磁盘 → 写 Supabase Storage 的 assets 桶
 * 由 SUPABASE_URL + SUPABASE_KEY 是否存在自动选择。
 */

const BUCKET = process.env.SUPABASE_BUCKET || 'assets'

function supabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  return url && key ? { url: url.replace(/\/$/, ''), key } : null
}

export function usingSupabaseStorage() {
  return supabaseConfig() !== null
}

// 资产落盘目录:生产环境挂 docker volume(/app/data),开发环境默认 ./data
export function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function contentTypeFor(relPath: string) {
  const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase()
  const map: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.srt': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  }
  return map[ext] || 'application/octet-stream'
}

export async function saveAsset(relPath: string, content: Buffer | string) {
  const sb = supabaseConfig()
  if (sb) {
    const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${relPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sb.key}`,
        apikey: sb.key,
        'Content-Type': contentTypeFor(relPath),
        'x-upsert': 'true',
      },
      body: new Uint8Array(body),
    })
    if (!res.ok) {
      throw new Error(`Supabase Storage 上传失败 ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    return relPath
  }

  const abs = path.join(dataDir(), relPath)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content)
  return relPath
}

export async function readAsset(relPath: string) {
  const sb = supabaseConfig()
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${relPath}`, {
      headers: { Authorization: `Bearer ${sb.key}`, apikey: sb.key },
    })
    if (!res.ok) throw new Error(`Supabase Storage 读取失败 ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  const abs = path.resolve(dataDir(), relPath)
  // 防目录穿越
  if (!abs.startsWith(path.resolve(dataDir()))) throw new Error('非法路径')
  return fs.readFile(abs)
}

export function assetUrl(relPath: string) {
  return `/api/assets/${relPath}`
}
