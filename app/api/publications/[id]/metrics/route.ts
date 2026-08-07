import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** 手工录入 24h/72h/168h 数据快照(Phase 3 后由抖音接口自动写入) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const atHours = Number(body.atHours)
  if (![24, 72, 168].includes(atHours)) {
    return NextResponse.json({ error: 'atHours 必须是 24|72|168' }, { status: 400 })
  }
  const snapshot = await prisma.metricSnapshot.upsert({
    where: { publicationId_atHours: { publicationId: params.id, atHours } },
    update: {
      plays: Number(body.plays) || 0,
      completionRate: body.completionRate != null ? Number(body.completionRate) : null,
      avgWatchSec: body.avgWatchSec != null ? Number(body.avgWatchSec) : null,
      likes: Number(body.likes) || 0,
      favorites: Number(body.favorites) || 0,
      shares: Number(body.shares) || 0,
      comments: Number(body.comments) || 0,
      followersDelta: Number(body.followersDelta) || 0,
      source: 'manual',
    },
    create: {
      publicationId: params.id,
      atHours,
      plays: Number(body.plays) || 0,
      completionRate: body.completionRate != null ? Number(body.completionRate) : null,
      avgWatchSec: body.avgWatchSec != null ? Number(body.avgWatchSec) : null,
      likes: Number(body.likes) || 0,
      favorites: Number(body.favorites) || 0,
      shares: Number(body.shares) || 0,
      comments: Number(body.comments) || 0,
      followersDelta: Number(body.followersDelta) || 0,
      source: 'manual',
    },
  })
  return NextResponse.json({ ok: true, snapshotId: snapshot.id })
}
