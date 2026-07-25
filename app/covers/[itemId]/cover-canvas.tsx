/* eslint-disable @next/next/no-img-element */
// 三套固定封面模板。规则(用户蓝图):
// - 标题最多3行,每行2-7个字
// - 白/橙/红/青中选两种
// - 背景是AI生成的人物/象征物,文字永远由这里程序化叠加
// - 底部不堆小字;安全区域居中

const FONT = `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`

const PALETTES: Record<string, { primary: string; secondary: string; glow: string }> = {
  truth: { primary: '#ffffff', secondary: '#f97316', glow: 'rgba(249,115,22,0.55)' }, // 白+橙
  counter: { primary: '#ffffff', secondary: '#22d3ee', glow: 'rgba(34,211,238,0.5)' }, // 白+青
  control: { primary: '#ef4444', secondary: '#ffffff', glow: 'rgba(239,68,68,0.55)' }, // 红+白
}

export function CoverCanvas({
  template,
  lines,
  bgUrl,
  fit,
}: {
  template: string
  lines: string[]
  bgUrl: string | null
  fit: boolean
}) {
  const palette = PALETTES[template] ?? PALETTES.truth
  const fontSize = lines.some((l) => l.length > 5) ? 150 : 180

  return (
    <>
      <style>{`html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }`}</style>
      {fit && (
        <style>{`
          #cover { transform: scale(calc(100vw / 1080)); transform-origin: top left; }
        `}</style>
      )}
        <div
          id="cover"
          style={{
            width: 1080,
            height: 1920,
            position: 'relative',
            background: 'radial-gradient(circle at 50% 35%, #10233a 0%, #0a1420 55%, #04070c 100%)',
            fontFamily: FONT,
            overflow: 'hidden',
          }}
        >
          {bgUrl && (
            <img
              src={bgUrl}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          {/* 顶部压暗,保证标题可读 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 34%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
            }}
          />

          {/* 标题区:上三分之一,安全区居中 */}
          <div
            style={{
              position: 'absolute',
              top: 130,
              left: 60,
              right: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
            }}
          >
            {lines.map((line, i) => {
              const color = i % 2 === 0 ? palette.primary : palette.secondary
              const skew = template === 'counter' ? 'skewX(-6deg)' : 'none'
              return (
                <div
                  key={i}
                  style={{
                    fontSize,
                    lineHeight: 1.12,
                    fontWeight: 900,
                    letterSpacing: 6,
                    color,
                    transform: skew,
                    textShadow: `0 0 46px ${palette.glow}, 0 10px 26px rgba(0,0,0,0.9), 0 3px 0 rgba(0,0,0,0.8)`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {line}
                </div>
              )
            })}
            {template === 'control' && (
              <div
                style={{
                  marginTop: 8,
                  width: 460,
                  height: 10,
                  background: `linear-gradient(90deg, transparent, ${palette.primary}, transparent)`,
                  boxShadow: `0 0 30px ${palette.glow}`,
                }}
              />
            )}
          </div>

          {/* 底部账号署名 + AI标识(合规) */}
          <div
            style={{
              position: 'absolute',
              bottom: 70,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 34,
              letterSpacing: 4,
              fontWeight: 600,
            }}
          >
            生意脑回路
            <span style={{ opacity: 0.55, fontSize: 26, marginLeft: 18 }}>AI辅助创作</span>
          </div>
        </div>
    </>
  )
}
