import { prisma } from '../prisma'
import { NOTE_STAGES, STAGES, Stage } from '../domain'
import { advanceItem } from './pipeline'
import { advanceNoteItem } from './note-pipeline'

/**
 * 流水线心跳:把所有在产内容各推一轮。
 *
 * 之前推进只能一条一条手点,是因为没有这么一个"发动机"。
 * 现在把它做成一个接口,谁调都行——自托管 worker、Vercel Cron、n8n 都可以,
 * 调用方只要按固定间隔敲这一下,内容就会自己从选题走到待审批。
 *
 * 时间预算是硬要求:这个接口跑在 serverless 上,有函数时长上限,
 * 所以一轮只做够预算的活,剩下的留给下一轮。它本来就是被反复调用的。
 */

/** 一次心跳的总预算。留出余量给函数上限 */
const DEFAULT_BUDGET_MS = Number(process.env.TICK_BUDGET_MS || 45_000)
/** 单条内容单轮的预算。给小一点,一次心跳才能照顾到多条 */
const PER_ITEM_BUDGET_MS = Number(process.env.TICK_ITEM_BUDGET_MS || 18_000)

/** 连续失败这么多次就先歇一会,别一直烧钱重试同一个错 */
const MAX_AUTO_FAILURES = Number(process.env.MAX_AUTO_FAILURES || 3)
/**
 * 熔断后隔多久再试一次。用冷却而不是永久拉黑,是因为最常见的失败原因是外部服务
 * 临时不可用(余额耗尽、限流、超时)——充值或恢复之后应该自己接着跑,
 * 不该等人去点一下。真正的死错误顶多每半小时白试一次,代价可以接受。
 */
const FAILURE_COOLDOWN_MS = Number(process.env.FAILURE_COOLDOWN_MS || 30 * 60 * 1000)

/**
 * 在产阶段。两条线的阶段序列不同,合起来取并集——
 * 心跳只负责"把在产的都推一轮",具体推哪个 handler 由 kind 决定。
 */
const IN_FLIGHT: string[] = Array.from(
  new Set([...STAGES, ...NOTE_STAGES].filter((s) => s !== 'awaiting_approval')),
)

export interface TickResult {
  advanced: Array<{ itemId: string; title: string; from: string; to: string; detail?: unknown }>
  failed: Array<{ itemId: string; title: string; stage: string; error: string }>
  skipped: number
  remaining: number
  budgetExhausted: boolean
}

/** 这条内容最近连着失败了几次(中间只要成功过一次就清零),以及最后一次的时间 */
async function recentFailureStreak(itemId: string, stage: string) {
  // 必须排掉 started:每次推进都会先记一条 started 再记结果,
  // 不排的话最近事件永远是 started/failed 交替,连续失败数永远只数到 1,
  // 熔断形同虚设——一条注定失败的内容会每一轮都重试,一直烧钱。
  const events = await prisma.pipelineEvent.findMany({
    where: { contentItemId: itemId, stage, status: { in: ['succeeded', 'failed'] } },
    orderBy: { createdAt: 'desc' },
    take: MAX_AUTO_FAILURES,
    select: { status: true, createdAt: true },
  })
  let streak = 0
  for (const e of events) {
    if (e.status === 'failed') streak++
    else break
  }
  return { streak, lastAt: events[0]?.createdAt ?? null }
}

export async function runPipelineTick(opts: { budgetMs?: number } = {}): Promise<TickResult> {
  const deadline = Date.now() + (opts.budgetMs ?? DEFAULT_BUDGET_MS)
  const result: TickResult = { advanced: [], failed: [], skipped: 0, remaining: 0, budgetExhausted: false }

  const items = await prisma.contentItem.findMany({
    where: { stage: { in: IN_FLIGHT } },
    orderBy: { stageEnteredAt: 'asc' },
    select: { id: true, title: true, stage: true, kind: true },
    take: 50,
  })
  result.remaining = items.length

  for (const item of items) {
    // 预留单条的预算,免得刚好卡在函数上限上被掐断
    if (Date.now() + PER_ITEM_BUDGET_MS > deadline) {
      result.budgetExhausted = true
      break
    }

    // 合成阶段不归这里管:它在等自托管 worker 来领,推它没有意义。
    // 图文没有这个阶段——卡片是 next/og 在函数里直接出的
    if (item.stage === 'compose') {
      result.skipped++
      continue
    }

    const { streak, lastAt } = await recentFailureStreak(item.id, item.stage)
    const coolingDown = lastAt != null && Date.now() - lastAt.getTime() < FAILURE_COOLDOWN_MS
    if (streak >= MAX_AUTO_FAILURES && coolingDown) {
      result.skipped++
      continue
    }

    try {
      const out =
        item.kind === 'video'
          ? await advanceItem(item.id, { budgetMs: PER_ITEM_BUDGET_MS })
          : await advanceNoteItem(item.id, { budgetMs: PER_ITEM_BUDGET_MS })
      result.advanced.push({
        itemId: item.id,
        title: item.title,
        from: item.stage,
        to: out.stage,
        detail: out.detail,
      })
    } catch (e) {
      result.failed.push({ itemId: item.id, title: item.title, stage: item.stage, error: String(e).slice(0, 400) })
    }
  }

  return result
}
