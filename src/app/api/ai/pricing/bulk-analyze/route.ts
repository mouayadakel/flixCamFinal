/**
 * @file route.ts
 * @description Bulk AI pricing analysis for all active equipment
 * @module api/ai/pricing/bulk-analyze
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AIService } from '@/lib/services/ai.service'
import { AIPolicy } from '@/lib/policies/ai.policy'
import { handleApiError } from '@/lib/utils/api-helpers'
import prisma from '@/lib/db/prisma'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const policy = await AIPolicy.canViewPricingSuggestions(session.user.id)
    if (!policy.allowed) {
      return NextResponse.json({ error: policy.reason }, { status: 403 })
    }

    const equipmentList = await prisma.equipment.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, model: true, sku: true, dailyPrice: true },
    })

    const results: {
      equipmentId: string
      equipmentName: string
      sku: string
      currentPrice: number
      utilizationRate: number
      suggestedPrice: number
      variance: number
      rationale?: string
    }[] = []

    const settled = await Promise.allSettled(
      equipmentList.map(async (eq) => {
        const currentPrice =
          typeof eq.dailyPrice === 'object' && eq.dailyPrice != null && 'toNumber' in eq.dailyPrice
            ? (eq.dailyPrice as { toNumber: () => number }).toNumber()
            : Number(eq.dailyPrice)
        return AIService.suggestPricing({
          equipmentId: eq.id,
          currentPrice,
        })
      })
    )

    settled.forEach((outcome, i) => {
      const eq = equipmentList[i]
      if (!eq) return
      const currentPrice =
        typeof eq.dailyPrice === 'object' && eq.dailyPrice != null && 'toNumber' in eq.dailyPrice
          ? (eq.dailyPrice as { toNumber: () => number }).toNumber()
          : Number(eq.dailyPrice)
      if (outcome.status === 'fulfilled') {
        const s = outcome.value
        const utilizationRate = (s.factors?.utilizationRate ?? 0) / 100
        results.push({
          equipmentId: eq.id,
          equipmentName: eq.model ?? eq.sku ?? eq.id,
          sku: eq.sku ?? '',
          currentPrice,
          utilizationRate,
          suggestedPrice: s.suggestedPrice,
          variance: Math.round((s.suggestedPrice - currentPrice) * 100) / 100,
          rationale: s.reasoning,
        })
      }
    })

    return NextResponse.json({ results }, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
