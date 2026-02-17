/**
 * @file route.ts
 * @description GET AI spend summary (daily/monthly spent vs budget) for cost guardrails UI
 * @module app/api/admin/ai/spend-summary
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { getSpendSummary } from '@/lib/utils/cost-tracker'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/ai/spend-summary
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const summary = await getSpendSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Spend summary failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load spend summary' },
      { status: 500 }
    )
  }
}
