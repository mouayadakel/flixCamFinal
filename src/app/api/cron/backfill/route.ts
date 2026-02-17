/**
 * @file route.ts
 * @description Vercel Cron: trigger nightly backfill scan. Protected by CRON_SECRET.
 * @module app/api/cron/backfill
 */

import { NextRequest, NextResponse } from 'next/server'
import { scanAndQueue } from '@/lib/services/catalog-scanner.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/backfill
 * Header: Authorization: Bearer <CRON_SECRET> or x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  const provided = cronSecret ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { jobId, report } = await scanAndQueue({
      types: ['text', 'photo', 'spec'],
      trigger: 'scheduled',
    })
    return NextResponse.json({
      data: {
        jobId,
        totalProducts: report.totalProducts,
        catalogQualityScore: report.catalogQualityScore,
        byGapType: report.byGapType,
      },
    })
  } catch (error) {
    console.error('Cron backfill failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    )
  }
}
