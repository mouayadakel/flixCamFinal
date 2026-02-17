/**
 * @file route.ts
 * @description GET content health scan: products with gaps (translations, SEO, photos, specs)
 * @module app/api/admin/ai/content-health
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { findProductsWithGaps } from '@/lib/services/content-health.service'
import type { GapType } from '@/lib/services/content-health.service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  gapType: z.enum(['translations', 'seo', 'description', 'photos', 'specs']).optional(),
})

/**
 * GET /api/admin/ai/content-health
 * Optional query: ?page=1&limit=20&gapType=translations|seo|photos|specs
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden - ai.use required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      gapType: searchParams.get('gapType'),
    })
    const { page, limit, gapType } = parsed.success ? parsed.data : { page: 1, limit: 20, gapType: undefined as GapType | undefined }

    const report = await findProductsWithGaps({ page, limit, gapType })

    let products = report.products
    if (gapType) {
      products = report.products.filter((p) => p.missingFields.includes(gapType))
    }

    return NextResponse.json({
      total: report.total,
      byGapType: report.byGapType,
      products,
      page,
      limit,
    })
  } catch (error) {
    console.error('Content health scan failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Content health scan failed' },
      { status: 500 }
    )
  }
}
