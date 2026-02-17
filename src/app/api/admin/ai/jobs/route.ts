/**
 * @file route.ts
 * @description GET list of AI jobs for analytics / job history
 * @module app/api/admin/ai/jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'
import { AiJobType } from '@prisma/client'

export const dynamic = 'force-dynamic'

const TYPE_MAP: Record<string, string> = {
  backfill: AiJobType.FULL_BACKFILL,
  text: AiJobType.TEXT_BACKFILL,
  photo: AiJobType.PHOTO_BACKFILL,
  spec: AiJobType.SPEC_BACKFILL,
  full: AiJobType.FULL_BACKFILL,
}

/**
 * GET /api/admin/ai/jobs?limit=20&type=backfill
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden - ai.use required' }, { status: 403 })
  }

  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10)))
  const typeParam = request.nextUrl.searchParams.get('type')
  const type = typeParam ? (TYPE_MAP[typeParam] ?? typeParam) : undefined

  try {
    const jobs = await prisma.aiJob.findMany({
      where: type ? { type: type as AiJobType } : undefined,
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('List AI jobs failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list jobs' },
      { status: 500 }
    )
  }
}
