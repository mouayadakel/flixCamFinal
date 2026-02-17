/**
 * GET /api/admin/ai/quality/trend?days=30
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { getQualityTrend } from '@/lib/services/quality-scorer.service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
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
    const days = parsed.success ? parsed.data.days : 30
    const trend = await getQualityTrend(days)
    return NextResponse.json({ data: trend })
  } catch (error) {
    console.error('Quality trend failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quality trend failed' },
      { status: 500 }
    )
  }
}
