import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 和应用端 lib/storage.ts 同一套规则:
 * 配了 SUPABASE_URL + SUPABASE_KEY 就传 Supabase Storage,否则写本地 DATA_DIR。
 * worker 必须和应用用同一个后端,否则应用读不到 worker 产出的成片。
 */

const BUCKET = process.env.SUPABASE_BUCKET || 'assets'

function supabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  return url && key ? { url: url.replace(/\/$/, ''), key } : null
}

export function storageBackend() {
  return supabaseConfig() ? 'supabase' : 'local'
}

export async function uploadAsset(relPath, buffer, contentType = 'application/octet-stream') {
  const sb = supabaseConfig()
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${relPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sb.key}`,
        apikey: sb.key,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    })
    if (!res.ok) {
      throw new Error(`Supabase Storage 上传失败 ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    return relPath
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
  const abs = path.join(dataDir, relPath)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, buffer)
  return relPath
}
