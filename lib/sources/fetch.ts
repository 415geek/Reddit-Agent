import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'node:crypto'
import type { FeedDef } from './feeds'

/** 从一个源里拉回来的一条原始素材,还没落库 */
export interface RawItem {
  fingerprint: string
  url: string
  title: string
  summary: string | null
  publishedAt: Date | null
}

const UA = 'Mozilla/5.0 (compatible; BizBrainBot/1.0; +https://bizbrain-c8geek.vercel.app)'
const TIMEOUT_MS = Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 15_000)

/**
 * 给 URL 算指纹。同一条新闻会被好几家转载、同一个链接也常带不同的追踪参数,
 * 所以先把 query、锚点、末尾斜杠和 www 都剥掉再哈希,否则同一篇文章
 * 每天都会被当成新素材重新采一遍。
 */
export function fingerprintUrl(url: string): string {
  let normalized = url.trim()
  try {
    const u = new URL(url)
    u.hash = ''
    u.search = ''
    u.protocol = 'https:'
    u.hostname = u.hostname.replace(/^www\./, '')
    u.pathname = u.pathname.replace(/\/+$/, '')
    normalized = u.toString()
  } catch {
    // 拿不到合法 URL 就退回原字符串,总比丢掉这条强
  }
  return createHash('sha1').update(normalized).digest('hex')
}

/** 去掉 HTML 标签和多余空白。RSS 的 description 里常常塞着整段 HTML */
export function stripHtml(input: string | null | undefined, maxLen = 1200): string | null {
  if (!input) return null
  const text = String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const decoded = decodeEntities(text)
  if (!decoded) return null
  return decoded.length > maxLen ? decoded.slice(0, maxLen) + '…' : decoded
}

/**
 * 解码常见 HTML 实体。行业媒体正文里 &rsquo; &mdash; &#8217; 满天飞,
 * 不解码就原样进稿子,模型还会有样学样往输出里写。
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7', deg: '\u00b0',
}

export function decodeEntities(s: string): string {
  return (
    s
      .replace(/&#(\d+);/g, (_m, n) => safeCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
      // 剥掉 NUL 和其他控制字符(保留换行/制表)。线上真的抓到过带 0x00 的网页——
      // Postgres 的 TEXT 拒收 0x00,rawText 写库直接炸,而且因为没存成,
      // 每次重试都重新抓、重新撞同一堵墙,条目就永远卡在挖素材
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  )
}

function safeCodePoint(n: number): string {
  // &#0; 会解码成 NUL;非法码点会让 fromCodePoint 抛错。两种都不值得留
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return ''
  return String.fromCodePoint(n)
}

function parseDate(v: unknown): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

async function getOnce(url: string, accept: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept },
      signal: ctrl.signal,
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 只对"临时性"的失败重试。
 * 实测联邦公报会间歇性甩 503(同一个地址上一分钟还好好的),
 * 不重试的话法规那一路——这个号最值钱的品类——会时不时整天空着。
 * 404 之类的是地址本身错了,重试多少次都一样,直接抛出去让白名单去改。
 */
const RETRYABLE = /HTTP (429|5\d\d)|aborted|ETIMEDOUT|ECONNRESET|fetch failed/i

async function get(url: string, accept: string, attempts = 3): Promise<string> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await getOnce(url, accept)
    } catch (e) {
      lastErr = e
      if (!RETRYABLE.test(String(e)) || i === attempts - 1) break
      // 退避要给够。1 秒、2 秒试过了不管用——联邦公报连着被敲几次就会甩 503,
      // 那是限流不是宕机,等 2 秒它还在生气,等 6 秒就好了。
      await new Promise((r) => setTimeout(r, 2000 * 3 ** i))
    }
  }
  throw lastErr
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // CDATA 直接当文本,不然 description 会解析成对象
  cdataPropName: false as unknown as string,
  trimValues: true,
})

/** 有的字段解析出来是对象({'#text': ...})或数组,统一挤成字符串 */
function text(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return text(v[0])
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return text(o['#text'] ?? o['@_href'] ?? '')
  }
  return String(v)
}

/** RSS 2.0 和 Atom 都吃。两种格式的字段名不同,但结构一样 */
function parseFeedXml(xml: string): RawItem[] {
  const doc = parser.parse(xml) as Record<string, any>
  const channel = doc?.rss?.channel ?? doc?.['rdf:RDF'] ?? doc?.feed ?? null
  if (!channel) return []

  const entries: any[] = []
  for (const key of ['item', 'entry']) {
    const v = channel[key]
    if (Array.isArray(v)) entries.push(...v)
    else if (v) entries.push(v)
  }

  const out: RawItem[] = []
  for (const e of entries) {
    // Atom 的 link 是属性 href,RSS 的是元素文本
    let link = text(e.link)
    if (!link && Array.isArray(e.link)) link = text(e.link.find((l: any) => l?.['@_rel'] !== 'self') ?? e.link[0])
    if (!link) link = text(e.guid) || text(e.id)
    const title = stripHtml(text(e.title), 300)
    if (!link || !title) continue

    out.push({
      fingerprint: fingerprintUrl(link),
      url: link,
      title,
      summary: stripHtml(text(e.description) || text(e.summary) || text(e['content:encoded']) || text(e.content)),
      publishedAt: parseDate(text(e.pubDate) || text(e.published) || text(e.updated) || text(e['dc:date'])),
    })
  }
  return out
}

/**
 * 联邦公报走 JSON API 而不是 RSS。
 * 它的 RSS 只有标题,而 JSON 能一次拿到 abstract 和文件类型(终稿规则 / 拟议规则),
 * 「已经生效」和「还在征求意见」对老板是两回事,这个区别必须留住。
 */
function parseFederalRegister(json: string): RawItem[] {
  const d = JSON.parse(json) as { results?: any[] }
  return (d.results ?? [])
    .filter((r) => r?.html_url && r?.title)
    .map((r) => ({
      fingerprint: fingerprintUrl(r.html_url),
      url: r.html_url as string,
      title: `[${r.type ?? 'Document'}] ${stripHtml(r.title, 300)}`,
      summary: stripHtml(r.abstract),
      publishedAt: parseDate(r.publication_date),
    }))
}

/**
 * 抓一篇文章的正文全文。
 *
 * RSS 摘要只有两三百字,数字和细节全在原文里。只靠摘要写稿,
 * 模型手里只有「42% 不赚钱」一个数,写六张卡就只能反复咀嚼这一个数——
 * 看起来专业不专业,差距主要在这儿:真正的行业文章里通常还有七八个
 * 支撑数字、来源机构、生效日期,全文抓下来这些才进得了稿子。
 *
 * 提取用的是够用的土办法:优先 <article>,砍掉 script/style/nav/footer/aside。
 * 不引 readability 库——白名单里都是正经媒体和政府站,结构规矩,
 * 土办法在它们身上够用;失败就返回 null,写稿退回用摘要,不算灾难。
 */
export async function fetchArticleText(url: string, maxLen = 8000): Promise<string | null> {
  let html: string
  try {
    html = await get(url, 'text/html,application/xhtml+xml')
  } catch {
    return null
  }
  let scope = html
  const article = html.match(/<article[\s>][\s\S]*?<\/article>/i)
  if (article) scope = article[0]
  else {
    const main = html.match(/<main[\s>][\s\S]*?<\/main>/i)
    if (main) scope = main[0]
  }
  const text = scope
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|footer|aside|header|form|figure)[\s>][\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const text2 = decodeEntities(text)
  // 太短说明没抓到正文(付费墙、纯 JS 渲染),宁可返回 null 也别把导航碎渣当正文
  if (text2.length < 400) return null
  return text2.length > maxLen ? text2.slice(0, maxLen) + '…' : text2
}

/** 拉一个源。失败就抛,调用方负责记 lastError,不让一个源挂掉整轮采集 */
export async function fetchFeed(feed: FeedDef): Promise<RawItem[]> {
  if (feed.kind === 'federal_register') {
    return parseFederalRegister(await get(feed.url, 'application/json'))
  }
  return parseFeedXml(await get(feed.url, 'application/rss+xml, application/xml, text/xml, */*'))
}
