import fs from 'fs/promises'
import path from 'path'

// 资产落盘目录:生产环境挂 docker volume(/app/data),开发环境默认 ./data
export function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

export async function saveAsset(relPath: string, content: Buffer | string) {
  const abs = path.join(dataDir(), relPath)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content)
  return relPath
}

export async function readAsset(relPath: string) {
  const abs = path.resolve(dataDir(), relPath)
  // 防目录穿越
  if (!abs.startsWith(path.resolve(dataDir()))) throw new Error('非法路径')
  return fs.readFile(abs)
}

export function assetUrl(relPath: string) {
  return `/api/assets/${relPath}`
}
