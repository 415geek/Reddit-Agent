import { NextRequest, NextResponse } from 'next/server'
import { checkWebhookSecret } from '@/lib/webhook'
import { collectSources } from '@/lib/sources/collect'
import { pickNoteTopics, queueNoteTopics } from '@/lib/agents/note-topics'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 图文的每日发条:采集 → 挑选题 → 排产。
 * 排产之后就不用管了——每小时的 tick 会把内容一路推到待审批。
 *
 * 合成一个接口而不是拆三个,是给 Vercel Cron 用的:Hobby 档的 cron 名额很紧,
 * 一天一敲这一个就够。n8n 或手动也都能调。
 *
 * 预算分配:采集不烧模型钱但走网络,给 25 秒;挑选题一次模型调用;
 * 排产是纯数据库。60 秒的函数上限内都排得下。
 */
export async function POST(req: NextRequest) {
  const denied = checkWebhookSecret(req)
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as { pick?: number; queue?: number }

  const collected = await collectSources({ budgetMs: 25_000 })
  const picked = await pickNoteTopics(body.pick ?? 5)
  const queued = await queueNoteTopics(body.queue ?? 3)

  return NextResponse.json({
    collected: { inserted: collected.inserted, duplicates: collected.duplicates, errors: collected.errors },
    picked,
    queued: queued.map((i) => ({ id: i.id, title: i.title })),
  })
}

/** GET 同义,Vercel Cron 是 GET 打进来的 */
export async function GET(req: NextRequest) {
  return POST(req)
}
