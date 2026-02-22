/**
 * @file route.ts
 * @description Public health check for load balancers and monitoring
 * @module app/api/health
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Public endpoint — no auth required. Used by load balancers and monitoring.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        db: 'disconnected',
      },
      { status: 503 }
    )
  }
}
