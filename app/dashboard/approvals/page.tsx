export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BgmMood, COVER_TEMPLATE_LABELS, ScriptBeats, Shot } from '@/lib/domain'
import { ApprovalActions } from './approval-actions'
import { AssetPreview } from './asset-preview'
import { NotePreview } from './note-preview'
import { AutoRunner } from '../production/auto-runner'
import { CLAIM_STATUS_LABELS, ClaimEvidence, NOTE_STAGES, QualityScores } from '@/lib/domain'

const BEAT_LABELS: Array<[keyof ScriptBeats, string]> = [
  ['hook', '0-3秒 · 反常识钩子'],
  ['scene', '3-15秒 · 熟悉场景'],
  ['principle', '15-50秒 · 原理'],
  ['caseStudy', '50-75秒 · 真实案例'],
  ['twist', '75-90秒 · 反转与行动'],
  ['interaction', '结尾 · 互动问题'],
]

export default async function ApprovalsPage() {
  const inFlightStages = NOTE_STAGES.filter((st) => st !== 'awaiting_approval') as string[]
  const [items, generating] = await Promise.all([
    prisma.contentItem.findMany({
      where: { stage: 'awaiting_approval' },
      include: {
        topic: { include: { series: true, sourceItem: true } },
        research: true,
        notes: { orderBy: { version: 'desc' }, take: 1 },
        scripts: { orderBy: { version: 'desc' }, take: 1 },
        storyboards: { orderBy: { version: 'desc' }, take: 1 },
        assets: true,
      },
      orderBy: { stageEnteredAt: 'desc' },
    }),
    // 生成中的也摆在这一页顶上:老板只认识两个页面,进度就得在他看的地方。
    // AutoRunner 顺便接管推进——打开这页,没跑完的会继续跑
    prisma.contentItem.findMany({
      where: { kind: 'note', stage: { in: inFlightStages } },
      select: { id: true, title: true, stage: true },
      orderBy: { stageEnteredAt: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">已完成</h1>
        <p className="text-[13px] sm:text-sm text-gray-500 mt-1">
          发布三步:复制标题 → 复制正文+话题 → 点开每张图长按保存。发到小红书时记得勾选 AI 声明。
        </p>
      </div>

      {generating.length > 0 && (
        <Card>
          <CardContent className="py-3 space-y-2">
            {generating.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700 truncate">{g.title}</p>
                <AutoRunner id={g.id} stage={g.stage} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {items.length === 0 && generating.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            还没有做完的内容。去选题库点「入队」,几分钟后这里就有。
          </CardContent>
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
                {(() => {
                  const qs = note?.qualityScores as QualityScores | null
                  if (!qs) return null
                  return (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="default">质量 {qs.total}/100</Badge>
                      <Badge variant="none">事实 {qs.factAccuracy}/20</Badge>
                      <Badge variant="none">实操 {qs.practicalValue}/20</Badge>
                      <Badge variant="none">北美 {qs.naFit}/15</Badge>
                      <Badge variant="none">逻辑 {qs.logic}/10</Badge>
                    </div>
                  )
                })()}
                {noteQc?.notes && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3">
                    <p className="text-xs font-semibold text-green-700">合规终审意见</p>
                    <p className="text-sm text-green-800 mt-0.5">{noteQc.notes}</p>
                  </div>
                )}
                {(() => {
                  const claims = (item.research?.claims ?? []) as unknown as ClaimEvidence[]
                  if (!claims.length) return null
                  const tone: Record<string, string> = {
                    verified_fact: 'text-green-700 bg-green-50 border-green-200',
                    supported_inference: 'text-blue-700 bg-blue-50 border-blue-200',
                    expert_opinion: 'text-gray-600 bg-gray-50 border-gray-200',
                    anecdotal_evidence: 'text-amber-700 bg-amber-50 border-amber-200',
                    unverified_claim: 'text-red-700 bg-red-50 border-red-200',
                    outdated: 'text-red-700 bg-red-50 border-red-200',
                    conflicting_sources: 'text-red-700 bg-red-50 border-red-200',
                  }
                  return (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-500">
                        证据链({claims.length} 条主张,逐条已定级)
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {claims.map((c) => (
                          <div key={c.id} className="text-xs flex gap-2 items-start">
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.5 ${tone[c.status] ?? tone.expert_opinion}`}
                            >
                              {CLAIM_STATUS_LABELS[c.status] ?? c.status}
                            </span>
                            <span className="text-gray-700">
                              {c.text}
                              <span className="text-gray-400">
                                {' '}
                                — {c.source}
                                {c.jurisdiction ? ` · ${c.jurisdiction}` : ''}
                                {c.timeLimit ? ` · ${c.timeLimit}` : ''}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )
                })()}
                {(() => {
                  const cr = note?.criticReport as { fatal?: string[]; major?: string[]; minor?: string[] } | null
                  const issues = [...(cr?.major ?? []), ...(cr?.minor ?? [])]
                  if (!cr || !issues.length) return null
                  return (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-500">反方审稿(已处理,存档备查)</summary>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        {issues.map((x, i) => (
                          <p key={i}>· {x}</p>
                        ))}
                      </div>
                    </details>
                  )
                })()}
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
