'use client'
import { useState } from 'react'
import { Shot } from '@/lib/domain'

interface AssetLite {
  id: string
  kind: string
  shotIndex: number | null
  provider: string
  path: string
  isMock: boolean
}

const isPlayableVideo = (p: string) => /\.(mp4|webm|mov)$/i.test(p)
const isPlayableAudio = (p: string) => /\.(mp3|wav|m4a)$/i.test(p)

/**
 * 审批时要看的东西:每个镜头的画面 + 动态片段、配音、成片。
 * 占位产物(mock)明确标出来,免得把占位当成品批准了。
 */
export function AssetPreview({ shots, assets }: { shots: Shot[]; assets: AssetLite[] }) {
  const [active, setActive] = useState<number | null>(null)

  const byShot = new Map<number, { image?: AssetLite; motion?: AssetLite }>()
  for (const a of assets) {
    if (a.shotIndex == null) continue
    const e = byShot.get(a.shotIndex) ?? {}
    if (a.kind === 'shot_image') e.image = a
    if (a.kind === 'motion_clip') e.motion = a
    byShot.set(a.shotIndex, e)
  }
  const voiceover = assets.find((a) => a.kind === 'voiceover')
  const finalVideo = assets.find((a) => a.kind === 'final_video')
  const subtitle = assets.find((a) => a.kind === 'subtitle')

  const url = (p: string) => `/api/assets/${p}`

  return (
    <div className="space-y-4">
      {/* 成片 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">成片</p>
        {!finalVideo && <p className="text-sm text-gray-400">尚未合成</p>}
        {finalVideo && isPlayableVideo(finalVideo.path) && (
          <video src={url(finalVideo.path)} controls className="w-full rounded-lg border bg-black" style={{ maxHeight: 420 }} />
        )}
        {finalVideo && !isPlayableVideo(finalVideo.path) && (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            当前是占位成片(<code className="text-xs">{finalVideo.path.split('/').pop()}</code>)。
            接入合成 worker 后这里会变成可播放的 1080×1920 视频。
          </div>
        )}
      </div>

      {/* 配音 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          配音{voiceover?.isMock && <span className="ml-2 text-amber-600">占位静音</span>}
        </p>
        {voiceover && isPlayableAudio(voiceover.path) ? (
          <audio src={url(voiceover.path)} controls className="w-full" />
        ) : (
          <p className="text-sm text-gray-400">尚未生成</p>
        )}
        {subtitle && (
          <a href={url(subtitle.path)} target="_blank" className="text-xs text-blue-600 hover:underline">
            查看字幕 SRT ↗
          </a>
        )}
      </div>

      {/* 分镜画面 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          分镜画面({byShot.size}/{shots.length})
        </p>
        <div className="grid grid-cols-4 gap-2">
          {shots.map((shot) => {
            const a = byShot.get(shot.idx)
            const src = a?.image ? url(a.image.path) : null
            return (
              <button
                key={shot.idx}
                onClick={() => setActive(active === shot.idx ? null : shot.idx)}
                className="relative rounded-md overflow-hidden border bg-gray-100 text-left"
                style={{ aspectRatio: '9/16' }}
                title={shot.narration}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={`镜头${shot.idx}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">待生成</div>
                )}
                <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 rounded">
                  {shot.idx}
                </span>
                {shot.type === 'motion' && (
                  <span className="absolute top-1 right-1 bg-orange-600 text-white text-[10px] px-1.5 rounded">
                    {a?.motion ? '🎥' : '🎥待生成'}
                  </span>
                )}
                {a?.image?.isMock && (
                  <span className="absolute bottom-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 rounded">占位</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 点开的镜头详情 */}
      {active != null && (() => {
        const shot = shots.find((s) => s.idx === active)
        const a = byShot.get(active)
        if (!shot) return null
        return (
          <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">镜头 {shot.idx} · {shot.durationSec}s · {shot.cameraMove}</p>
              <button onClick={() => setActive(null)} className="text-xs text-gray-500 hover:text-gray-800">收起</button>
            </div>
            <p className="text-sm text-gray-800">{shot.narration}</p>
            {a?.motion && isPlayableVideo(a.motion.path) && (
              <video src={url(a.motion.path)} controls loop className="rounded-md border bg-black" style={{ maxHeight: 360 }} />
            )}
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">画面提示词</summary>
              <p className="mt-1 whitespace-pre-wrap">{shot.imagePrompt}</p>
              {shot.motionPrompt && <p className="mt-1 whitespace-pre-wrap text-orange-700">动作:{shot.motionPrompt}</p>}
            </details>
          </div>
        )
      })()}
    </div>
  )
}
