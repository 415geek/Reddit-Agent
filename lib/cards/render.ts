import { ImageResponse } from 'next/og'
import { CardLayout, type CardLayoutInput } from './layout'
import { loadCardFonts } from './fonts'
import { readAsset } from '../storage'
import { CARD_HEIGHT, CARD_WIDTH } from '../domain'

/**
 * 把一张卡片渲染成 PNG。
 *
 * 这是整条图文线能全跑在 Vercel 上的关键:next/og 底层是 Satori + resvg,
 * 纯 JS,不需要浏览器。之前视频那条线的封面要起 Playwright 截图,
 * 只能丢给自托管 worker——而那台 worker 到今天一次都没跑起来过。
 */

/**
 * 认字节,不认文件名。
 *
 * 一开始按扩展名推 MIME,结果卡片上的图一片空白还不报错——
 * 生图接口下回来的文件叫 shot_0.png,前四个字节却是 ffd8ffe0,是张 JPEG。
 * data URI 里写着 image/png、给的是 JPEG 的字节,解码器不抛错,就是什么都不画。
 * 文件名是我们自己起的,provider 给什么格式并不受它约束,所以只能看真身。
 */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp'
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif'
  return null
}

/** 把资产读成 data: URI 内联进卡片 */
async function inlineImage(relPath: string | null | undefined): Promise<string | null> {
  if (!relPath) return null
  let buf: Buffer
  try {
    buf = Buffer.from(await readAsset(relPath))
  } catch (e) {
    // 图挂了不该让整张卡片渲不出来:退回暖色底,文字照样成立
    console.warn(`[cards] 读不到配图 ${relPath}:${String(e).slice(0, 120)}`)
    return null
  }
  const mime = sniffMime(buf)
  if (!mime) {
    console.warn(`[cards] 配图 ${relPath} 不是认得的图片格式,前 8 字节 ${buf.subarray(0, 8).toString('hex')}`)
    return null
  }
  return `data:${mime};base64,${buf.toString('base64')}`
}

export interface RenderCardInput extends Omit<CardLayoutInput, 'imageSrc'> {
  /** 资产相对路径。渲染时读出来内联,不走 HTTP */
  imagePath?: string | null
}

/**
 * 图为什么要内联成 data URI 而不是给个 URL 让它自己去拉:
 * 资产接口和这个渲染接口跑在同一个函数里,让函数在处理请求的过程中
 * 再回头请求自己,在 serverless 上很容易把并发槽占满、互相等死。
 * 直接从存储读字节最短也最稳。
 */
export async function renderCardPng(input: RenderCardInput): Promise<Buffer> {
  const [fonts, imageSrc] = await Promise.all([loadCardFonts(), inlineImage(input.imagePath)])
  const res = new ImageResponse(CardLayout({ ...input, imageSrc }), {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  })
  return Buffer.from(await res.arrayBuffer())
}
