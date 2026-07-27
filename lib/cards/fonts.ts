import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 卡片渲染用的中文字体。
 *
 * Satori(next/og 的底层)不认系统字体,必须把字体的字节喂给它,
 * 所以子集文件跟着仓库一起走(public/fonts,由 scripts/build-fonts.py 生成)。
 *
 * 读一次就缓存住:同一个函数实例会连着渲十几张卡片,
 * 每张都从磁盘读 3MB 的话,时间全花在 I/O 上了。
 */

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')

let cache: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }> | null = null

export async function loadCardFonts() {
  if (cache) return cache
  const [regular, bold] = await Promise.all([
    fs.readFile(path.join(FONT_DIR, 'NotoSansSC-Regular.subset.ttf')),
    fs.readFile(path.join(FONT_DIR, 'NotoSansSC-Bold.subset.ttf')),
  ])
  cache = [
    { name: 'NotoSansSC', data: toArrayBuffer(regular), weight: 400, style: 'normal' },
    { name: 'NotoSansSC', data: toArrayBuffer(bold), weight: 700, style: 'normal' },
  ]
  return cache
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
