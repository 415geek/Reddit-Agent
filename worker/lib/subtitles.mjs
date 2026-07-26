/**
 * 字幕生成。
 *
 * 不用应用端存的那份 SRT:那份是按分镜的"估算时长"切的,而成片时长要对齐
 * 真实配音长度,两者对不上字幕就会整体漂移。这里按同样的缩放重算。
 *
 * 烧字幕直接生成 ASS 而不是 SRT:SRT 转成 ASS 时 libass 用的是默认的
 * 384x288 坐标系,字号和边距都会按那个尺度算,在 1080x1920 上字大得离谱、
 * 位置也全错。ASS 里写死 PlayResX/Y 才能拿到可预期的排版。
 */

const MAX_CHARS = Number(process.env.SUBTITLE_MAX_CHARS || 14)
const FONT = process.env.SUBTITLE_FONT || 'Noto Sans CJK SC'
const FONT_SIZE = Number(process.env.SUBTITLE_FONT_SIZE || 66)
/** 距底边的距离。抖音底部有文案、头像、按钮,字幕压太低会被盖住 */
const MARGIN_V = Number(process.env.SUBTITLE_MARGIN_V || 340)

const PUNCT = /[,，。!！?？;；、:：]/

/** 按标点切句;切完还超长的再均分,避免出现只剩一个标点的一闪 */
export function splitNarration(text, maxChars = MAX_CHARS) {
  const cleaned = String(text || '').replace(/\s+/g, '')
  if (!cleaned) return []

  const parts = []
  let buf = ''
  for (const ch of cleaned) {
    buf += ch
    if (PUNCT.test(ch)) {
      parts.push(buf)
      buf = ''
    }
  }
  if (buf) parts.push(buf)

  // 短句并回上一句
  const merged = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (last && last.length + part.length <= maxChars) merged[merged.length - 1] = last + part
    else merged.push(part)
  }

  const out = []
  for (const seg of merged) {
    if (seg.length <= maxChars) {
      out.push(seg)
      continue
    }
    // 均分而不是按 maxChars 硬切,否则最后一块可能只剩一两个字
    const n = Math.ceil(seg.length / maxChars)
    const size = Math.ceil(seg.length / n)
    for (let i = 0; i < seg.length; i += size) out.push(seg.slice(i, i + size))
  }
  return out
}

/** shots: [{ narration, startSec, durationSec }] → 扁平的字幕条目 */
export function buildCues(shots) {
  const cues = []
  for (const shot of shots) {
    const lines = splitNarration(shot.narration)
    if (!lines.length) continue
    // 镜头内按字数分配时间:字多的句子念得久,这样字幕跟人声大致同步
    const totalChars = lines.reduce((n, l) => n + l.length, 0) || 1
    let t = shot.startSec
    for (const line of lines) {
      const dur = (shot.durationSec * line.length) / totalChars
      cues.push({ start: t, end: t + dur, text: line })
      t += dur
    }
  }
  return cues
}

function srtStamp(sec) {
  const ms = Math.max(0, Math.round(sec * 1000))
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`
}

function assStamp(sec) {
  const cs = Math.max(0, Math.round(sec * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}

export function buildSrt(shots) {
  return buildCues(shots)
    .map((c, i) => `${i + 1}\n${srtStamp(c.start)} --> ${srtStamp(c.end)}\n${c.text}\n`)
    .join('\n')
}

/** 烧进画面用的 ASS。白字黑描边 + 半透明底,亮画面暗画面上都读得清 */
export function buildAss(shots, { width = 1080, height = 1920 } = {}) {
  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // 颜色是 &HAABBGGRR,AA=00 才是不透明。描边必须实黑,否则压在亮画面上会糊掉
    `Style: Sub,${FONT},${FONT_SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,1,0,1,5,3,2,70,70,${MARGIN_V},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]
  const events = buildCues(shots).map(
    (c) => `Dialogue: 0,${assStamp(c.start)},${assStamp(c.end)},Sub,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`,
  )
  return [...head, ...events].join('\n') + '\n'
}
