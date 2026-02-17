/**
 * @file route.ts
 * @description GET list of product images pending AI review (with optional filters)
 * @module app/api/admin/ai/pending-images
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/ai/pending-images
 * Query: productId?, source? (AI_GENERATED etc), limit? (default 100)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.AI_USE))) {
    return NextResponse.json({ error: 'Forbidden - ai.use required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId') ?? undefined
  const source = searchParams.get('source') ?? undefined
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100))

  try {
    const items = await prisma.productImage.findMany({
      where: {
        pendingReview: true,
        isDeleted: false,
        ...(productId && { productId }),
        ...(source && { imageSource: source }),
      },
      include: {
        product: {
          select: {
            id: true,
            translations: { where: { locale: 'en' }, take: 1, select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const list = items.map((img) => ({
      id: img.id,
      url: img.url,
      imageSource: img.imageSource,
      qualityScore: img.qualityScore,
      productId: img.productId,
      productName: img.product.translations[0]?.name ?? img.product.id,
      createdAt: img.createdAt,
    }))

    return NextResponse.json({ items: list, total: list.length })
  } catch (error) {
    console.error('Pending images fetch failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pending images' },
      { status: 500 }
    )
  }
}
