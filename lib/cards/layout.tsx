import type { ReactElement } from 'react'
import { CARD_HEIGHT, CARD_WIDTH } from '../domain'

/**
 * 小红书图文卡片的版式。照着现有账号复刻,尺寸按 1080×1440(3:4)定死。
 *
 * 为什么是 3:4 而不是竖屏 9:16:小红书 feed 里超过 3:4 的图会被裁,
 * 标题正好在裁掉的那一截里。账号现有的图也都是 3:4。
 *
 * 版式自上而下:
 *   配图(58%)
 *   ├ 栏目标签   小号、砖红、字距略松       「消费者心理 · 时段」
 *   ├ 标题第一行 特大号、近黑、粗            「晚市在变早」
 *   ├ 标题第二行 特大号、砖红、粗            「4点档涨13%」
 *   ├ 左侧红竖线 + 正文  小号、深灰、行距松
 *   └ 右下角页码 极小号、浅灰                「01 / 05」
 *
 * 两行标题必须成对读:第一行抛现象,第二行给反转。这是这个号最强的记忆点。
 *
 * 注意:这里的 JSX 是给 Satori 渲染的,不是浏览器。
 * Satori 只认 flexbox,不认 grid / float / position:absolute 的常规用法,
 * 而且任何有多个子节点的元素都必须显式写 display:flex,否则直接报错。
 */

const RED = '#B03A2E' // 标题第二行和竖线的砖红
const RED_LABEL = '#C0392B' // 栏目标签,比标题红略亮
const INK = '#1A1A1A'
const BODY = '#3D3D3D'
const MUTED = '#9AA0A6'

/**
 * 配图不再写死高度,改成"占满白卡剩下的地方"、但不低于这个下限。
 *
 * 一开始按参考图量的 58% 写死,带要点列表的卡片直接溢出:
 * 四条要点里只露出两条,页码整个被挤到画布外面。
 * 版式里唯一能让步的是配图——文字少了不成立,配图矮一点还是好看的。
 */
const IMAGE_MIN_H = Math.round(CARD_HEIGHT * 0.42)
const PAD_X = 60

/** 正文和要点的长度上限。提示词里也会约束,这里是兜底——模型总有不听话的时候 */
const BODY_MAX = 110
const BULLET_MAX = 22
const BULLET_COUNT = 4

function clip(s: string, max: number) {
  const t = (s ?? '').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

export interface CardLayoutInput {
  label: string
  titleTop: string
  titleBottom: string
  body: string
  bullets?: string[]
  /** data: URI 或绝对地址。没有图就渲染一块暖色底,不留白 */
  imageSrc: string | null
  pageNo: number
  pageTotal: number
}

/**
 * 标题字号按字数收缩。
 * 账号里的标题短的 4 个字(「翻台慢」)、长的 9 个字(「35% 的客人」这种带数字的更宽),
 * 固定字号会让长标题溢出到第二行,两行标题的对仗结构就毁了。
 */
function titleSize(a: string, b: string) {
  const longest = Math.max(width(a), width(b))
  if (longest <= 6) return 92
  if (longest <= 8) return 82
  if (longest <= 10) return 72
  if (longest <= 12) return 64
  return 56
}

/** 按视觉宽度算长度:一个汉字约等于两个半角字符 */
function width(s: string) {
  let w = 0
  for (const ch of s) w += /[\x00-\xff]/.test(ch) ? 0.5 : 1
  return w
}

export function CardLayout(input: CardLayoutInput): ReactElement {
  const size = titleSize(input.titleTop, input.titleBottom)
  const bullets = (input.bullets ?? []).slice(0, BULLET_COUNT).map((b) => clip(b, BULLET_MAX))
  const body = clip(input.body, BODY_MAX)

  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'NotoSansSC',
      }}
    >
      {/* 配图:吃掉白卡剩下的高度,不低于下限 */}
      <div
        style={{
          width: CARD_WIDTH,
          display: 'flex',
          flexGrow: 1,
          flexShrink: 1,
          minHeight: IMAGE_MIN_H,
          overflow: 'hidden',
          backgroundColor: '#EADAC8',
        }}
      >
        {input.imageSrc ? (
          <img
            src={input.imageSrc}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            style={{ width: CARD_WIDTH, height: '100%', objectFit: 'cover' }}
          />
        ) : null}
      </div>

      {/* 白卡:高度由内容决定,不压缩 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          backgroundColor: '#FFFFFF',
          paddingTop: 44,
          paddingLeft: PAD_X,
          paddingRight: PAD_X,
          paddingBottom: 36,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            fontWeight: 700,
            color: RED_LABEL,
            letterSpacing: 2,
            marginBottom: 22,
          }}
        >
          {input.label}
        </div>

        <div style={{ display: 'flex', fontSize: size, fontWeight: 700, color: INK, lineHeight: 1.16 }}>
          {input.titleTop}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: size,
            fontWeight: 700,
            color: RED,
            lineHeight: 1.16,
            marginTop: 6,
          }}
        >
          {input.titleBottom}
        </div>

        {/* 左红竖线 + 正文 */}
        <div style={{ display: 'flex', flexDirection: 'row', marginTop: 30 }}>
          <div style={{ display: 'flex', width: 6, backgroundColor: RED, marginRight: 22, borderRadius: 3 }} />
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <div style={{ display: 'flex', fontSize: 30, color: BODY, lineHeight: 1.62 }}>{body}</div>
            {bullets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
                {bullets.map((b, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', flexDirection: 'row', fontSize: 28, color: BODY, lineHeight: 1.5 }}
                  >
                    <div style={{ display: 'flex', color: RED, marginRight: 10 }}>·</div>
                    <div style={{ display: 'flex' }}>{b}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* 页码。白卡现在是按内容收缩的,不能再用 flexGrow 把它顶到底部——
            那样会把白卡重新撑到满高,配图就没了 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26, fontSize: 26, color: MUTED }}>
          {String(input.pageNo).padStart(2, '0')} / {String(input.pageTotal).padStart(2, '0')}
        </div>
      </div>
    </div>
  )
}
