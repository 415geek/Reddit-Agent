import { prisma } from '../prisma'

export async function logEvent(opts: {
  contentItemId?: string
  stage: string
  status: 'started' | 'succeeded' | 'failed'
  detail?: Record<string, unknown>
  error?: string
}) {
  await prisma.pipelineEvent.create({
    data: {
      contentItemId: opts.contentItemId,
      stage: opts.stage,
      status: opts.status,
      detail: (opts.detail ?? {}) as object,
      error: opts.error,
    },
  })
}
