/**
 * GET /api/admin/ai/quality/products?sort=score&order=asc&limit=20&offset=0&gap=photos
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { getCachedScan } from '@/lib/services/quality-scorer.service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  sort: z.enum(['score', 'name']).optional().default('score'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  gap: z.enum(['photos', 'descriptions', 'seo', 'specs', 'translations', 'shortDescription']).optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden - ai.use required' }, { status: 403 })
  }

  try {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    const { sort, order, limit, offset, gap } = parsed.success ? parsed.data : querySchema.parse({})
    const scan = await getCachedScan()
    let list = scan.products.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.contentScore,
      gap: p.gaps.join(','),
      gaps: p.gaps,
    }))
    if (gap) {
      list = list.filter((p) => p.gaps.includes(gap))
    }
    const total = list.length
    const sorted =
      sort === 'name'
        ? [...list].sort((a, b) => (order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
        : [...list].sort((a, b) => (order === 'asc' ? a.score - b.score : b.score - a.score))
    const products = sorted.slice(offset, offset + limit).map(({ gaps: _, ...rest }) => rest)
    return NextResponse.json({
      data: { products, total },
    })
  } catch (error) {
    console.error('Quality products failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quality products failed' },
      { status: 500 }
    )
  }
}
