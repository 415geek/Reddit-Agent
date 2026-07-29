export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BgmMood, COVER_TEMPLATE_LABELS, ScriptBeats, Shot } from '@/lib/domain'
import { ApprovalActions } from './approval-actions'
import { AssetPreview } from './asset-preview'
import { NotePreview } from './note-preview'

const BEAT_LABELS: Array<[keyof ScriptBeats, string]> = [
  ['hook', '0-3秒 · 反常识钩子'],
  ['scene', '3-15秒 · 熟悉场景'],
  ['principle', '15-50秒 · 原理'],
  ['caseStudy', '50-75秒 · 真实案例'],
  ['twist', '75-90秒 · 反转与行动'],
  ['interaction', '结尾 · 互动问题'],
]

export default async function ApprovalsPage() {
  const items = await prisma.contentItem.findMany({
    where: { stage: 'awaiting_approval' },
    include: {
      topic: { include: { series: true, sourceItem: true } },
      research: true,
      notes: { orderBy: { version: 'desc' }, take: 1 },
      scripts: { orderBy: { version: 'desc' }, take: 1 },
      storyboards: { orderBy: { version: 'desc' }, take: 1 },
      assets: true,
    },
    orderBy: { stageEnteredAt: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">审批队列</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
          {items.length} 条待审批。批准后:长按存图 → 复制文案 → 去小红书发布(勾选 AI 声明),再到「已发布」页登记链接。
        </p>
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">队列为空。生产完成的内容会出现在这里。</CardContent>
        </Card>
      )}

      {items.map((item) => {
        // ── 图文:整组卡片 + 一键复制文案 ────────────────────────────────
        if (item.kind === 'note') {
          const note = item.notes[0]
          const cards = item.assets
            .filter((a) => a.kind === 'card_final')
            .sort((a, b) => (a.shotIndex ?? 0) - (b.shotIndex ?? 0))
            .map((a) => ({ idx: a.shotIndex ?? 0, url: `/api/assets/${a.path}` }))
          const noteQc = note?.qcReport as { notes?: string } | null
          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">
                      {note ? `${note.titleTop} / ${note.titleBottom}` : item.title}
                    </CardTitle>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="default">小红书图文</Badge>
                      <Badge variant="none">{cards.length} 张卡</Badge>
                      {item.topic.sourceItem && <Badge variant="outline">{item.topic.sourceItem.source}</Badge>}
                    </div>
                  </div>
                  <ApprovalActions id={item.id} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {note && (
                  <NotePreview
                    itemId={item.id}
                    cards={cards}
                    noteTitle={note.noteTitle}
                    bodyText={note.bodyText}
                    hashtags={note.hashtags}
                  />
                )}
                {noteQc?.notes && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3">
                    <p className="text-xs font-semibold text-green-700">质检意见</p>
                    <p className="text-sm text-green-800 mt-0.5">{noteQc.notes}</p>
                  </div>
                )}
                {item.topic.sourceItem && (
                  <p className="text-xs text-gray-400">
                    素材来源:
                    <a className="underline hover:text-orange-600" href={item.topic.sourceItem.url} target="_blank" rel="noreferrer">
                      {item.topic.sourceItem.title}
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          )
        }

        // ── 视频(停用但保留):原样 ──────────────────────────────────────
        const script = item.scripts[0]
        const beats = (script?.beats ?? {}) as unknown as ScriptBeats
        const shots = ((item.storyboards[0]?.shots ?? []) as unknown as Shot[]) || []
        const qc = script?.qcReport as { notes?: string } | null
        return (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">{item.title}</CardTitle>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {item.topic.series && <Badge variant="outline">{item.topic.series.name}</Badge>}
                    <Badge variant="default">{COVER_TEMPLATE_LABELS[item.coverTemplate]}封面</Badge>
                    <Badge variant="none">约{script?.durationEstSec ?? 90}秒</Badge>
                    <Badge variant="none">{shots.length}镜头 / {shots.filter((s) => s.type === 'motion').length}动态</Badge>
                  </div>
                </div>
                <ApprovalActions id={item.id} />
              </div>
            </CardHeader>
            <CardContent>
              {/* 手机单栏:先看成片和画面,再看文案——审批时眼睛先找的是画面 */}
              <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
                <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
                  <div className="space-y-3">
                    {BEAT_LABELS.map(([key, label]) => (
                      <div key={key}>
                        <p className="text-xs font-semibold text-orange-600 uppercase">{label}</p>
                        <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{beats[key] ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                  {qc?.notes && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3">
                      <p className="text-xs font-semibold text-green-700">质检意见</p>
                      <p className="text-sm text-green-800 mt-0.5">{qc.notes}</p>
                    </div>
                  )}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-500">分镜清单({shots.length})</summary>
                    <div className="mt-2 space-y-1.5">
                      {shots.map((s) => (
                        <div key={s.idx} className="flex gap-2 text-xs text-gray-600">
                          <span className="font-mono flex-shrink-0">#{s.idx}</span>
                          <span className="flex-shrink-0">{s.type === 'motion' ? '🎥动态' : '🖼静态'} {s.durationSec}s</span>
                          <span className="truncate">{s.narration}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                  {item.research && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-500">研究资料与来源</summary>
                      <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                        <p className="font-medium text-gray-800">{item.research.coreClaim}</p>
                        {((item.research.supportingFacts as Array<{ claim: string; source: string; confidence: number }>) || []).map((f, i) => (
                          <p key={i}>• {f.claim} <span className="text-gray-400">({f.source},置信度{f.confidence}</span>)</p>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <div className="space-y-4 order-1 lg:order-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">封面预览(1080×1920)</p>
                  <div className="rounded-lg overflow-hidden border bg-black mx-auto w-full max-w-[240px] lg:max-w-none" style={{ aspectRatio: '9/16' }}>
                    <iframe
                      src={`/covers/${item.id}?scale=fit`}
                      className="w-full h-full"
                      style={{ border: 'none' }}
                      title={`cover-${item.id}`}
                    />
                  </div>
                  <AssetPreview
                    shots={shots}
                    bgmMood={
                      (item.storyboards[0]?.bgmMood ??
                        (item.assets.find((a) => a.kind === 'bgm')?.meta as { mood?: string } | null)?.mood) as BgmMood | null
                    }
                    assets={item.assets.map((a) => ({
                      id: a.id, kind: a.kind, shotIndex: a.shotIndex,
                      provider: a.provider, path: a.path, isMock: a.isMock,
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
