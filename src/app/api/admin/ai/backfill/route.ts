/**
 * @file route.ts
 * @description POST trigger batch backfill, GET job status
 * @module app/api/admin/ai/backfill
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { addBackfillJob } from '@/lib/queue/backfill.queue'
import { getProductIdsWithGaps } from '@/lib/services/content-health.service'
import { prisma } from '@/lib/db/prisma'
import { JobStatus } from '@prisma/client'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const postBodySchema = z.object({
  productIds: z.array(z.string().cuid()).optional(),
  fillAll: z.boolean().optional().default(false),
})

/** User-friendly message when queue/Redis is unavailable */
function isQueueConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /redis|ECONNREFUSED|connection refused|queue/i.test(msg) ||
    (err as NodeJS.ErrnoException)?.code === 'ECONNREFUSED'
  )
}

/**
 * POST /api/admin/ai/backfill
 * Body: { productIds?: string[], fillAll?: boolean }
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden - ai.use required' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = postBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { productIds, fillAll } = parsed.data

    let ids: string[]
    if (fillAll) {
      ids = await getProductIdsWithGaps()
    } else if (productIds?.length) {
      ids = productIds
    } else {
      return NextResponse.json(
        { error: 'Provide productIds or fillAll: true' },
        { status: 400 }
      )
    }

    if (ids.length === 0) {
      return NextResponse.json({
        jobId: '',
        queued: 0,
        estimatedMinutes: 0,
        message: 'لا توجد منتجات تحتاج ملء',
      })
    }

    const result = await addBackfillJob(ids, {
      createdBy: session.user.id,
    })

    return NextResponse.json({
      jobId: result.jobId,
      queued: result.queued,
      estimatedMinutes: result.estimatedMinutes,
    })
  } catch (error) {
    console.error('Backfill trigger failed:', error)
    const message = isQueueConnectionError(error)
      ? 'قائمة المعالجة غير متاحة. تأكد من تشغيل Redis.'
      : error instanceof Error ? error.message : 'فشل تشغيل الملء'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/ai/backfill?jobId=xxx
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden - ai.use required' }, { status: 403 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  try {
    const job = await prisma.aiJob.findUnique({
      where: { id: jobId },
    })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const total = job.totalItems ?? 0
    const progress = total > 0 ? Math.round((job.processed / total) * 100) : 0
    // Normalize status for UI (content-health tab expects 'done' | 'failed' | 'running')
    const statusRaw = job.status
    const status =
      statusRaw === JobStatus.COMPLETED
        ? 'done'
        : statusRaw === JobStatus.FAILED
          ? 'failed'
          : statusRaw === JobStatus.RUNNING || statusRaw === JobStatus.PENDING
            ? 'running'
            : String(statusRaw).toLowerCase()

    return NextResponse.json({
      status,
      progress,
      processed: job.processed,
      total,
      succeeded: job.succeeded,
      failed: job.failed,
      skipped: job.skipped,
      completedAt: job.completedAt,
      errorLog: job.errorLog,
    })
  } catch (error) {
    console.error('Backfill status failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status failed' },
      { status: 500 }
    )
  }
}
