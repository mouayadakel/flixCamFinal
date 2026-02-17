/**
 * Catalog scanner: detects content gaps, builds gap report, and queues backfill jobs.
 * Uses quality-scorer for cached scan and content-health for product IDs with gaps.
 */

import { prisma } from '@/lib/db/prisma'
import { AiJobType, JobStatus } from '@prisma/client'
import { getCachedScan } from '@/lib/services/quality-scorer.service'
import { backfillQueue, type BackfillJobData } from '@/lib/queue/backfill.queue'
import type { BackfillOptions, ContentGapReport } from '@/lib/types/backfill.types'

/**
 * Scan only — returns gap report without queuing. Uses Redis cache (5 min TTL) when available.
 */
export async function scanOnly(): Promise<ContentGapReport> {
  const scan = await getCachedScan()
  return {
    scannedAt: scan.scannedAt,
    totalProducts: scan.totalProducts,
    totalEquipment: 0,
    byGapType: {
      missingTranslations: scan.byGapType.missingTranslations,
      missingSeo: scan.byGapType.missingSeo,
      missingDescription: scan.byGapType.missingDescription,
      missingPhotos: scan.byGapType.missingPhotos,
      missingSpecs: scan.byGapType.missingSpecs,
    },
    catalogQualityScore: scan.catalogQualityScore,
    products: scan.products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      contentScore: p.contentScore,
      gaps: p.gaps,
      imageCount: p.imageCount,
      lastAiRunAt: p.lastAiRunAt,
    })),
  }
}

/**
 * Main entry: scan catalog for gaps and queue backfill jobs. Returns job ID and report.
 */
export async function scanAndQueue(options: BackfillOptions): Promise<{
  jobId: string
  report: ContentGapReport
}> {
  const report = await scanOnly()
  let productIds = options.productIds ?? report.products.map((p) => p.id)

  if (options.minQualityScore != null) {
    productIds = report.products
      .filter((p) => p.contentScore < options.minQualityScore!)
      .map((p) => p.id)
  }
  if (options.maxProducts != null && productIds.length > options.maxProducts) {
    productIds = productIds.slice(0, options.maxProducts)
  }

  if (options.dryRun) {
    return {
      jobId: '',
      report,
    }
  }

  const jobId = await queueBackfillJob({
    productIds,
    types: options.types,
    trigger: options.trigger,
    triggeredBy: options.triggeredBy,
  })
  return { jobId, report }
}

/**
 * Queue a single product for backfill (e.g. from event or "Backfill now" button).
 */
export async function queueSingleProduct(
  productId: string,
  types: Array<'text' | 'photo' | 'spec'>,
  trigger: 'manual' | 'event',
  options?: { triggeredBy?: string }
): Promise<string> {
  return queueBackfillJob({
    productIds: [productId],
    types,
    trigger,
    triggeredBy: options?.triggeredBy,
  })
}

/**
 * Create AiJob + AiJobItems and add job to BullMQ. Uses new schema (AiJobType, JobStatus, totalItems, etc.).
 */
async function queueBackfillJob(params: {
  productIds: string[]
  types: Array<'text' | 'photo' | 'spec'>
  trigger: string
  triggeredBy?: string
}): Promise<string> {
  const { productIds, types, trigger, triggeredBy } = params
  if (productIds.length === 0) return ''

  const jobType: AiJobType =
    types.length === 3 ? AiJobType.FULL_BACKFILL : types.includes('photo') ? AiJobType.PHOTO_BACKFILL : types.includes('spec') ? AiJobType.SPEC_BACKFILL : AiJobType.TEXT_BACKFILL

  const aiJob = await prisma.aiJob.create({
    data: {
      type: jobType,
      status: JobStatus.PENDING,
      triggeredBy: trigger,
      totalItems: productIds.length,
      metadata: triggeredBy ? { triggeredBy } : undefined,
    },
  })

  await prisma.aiJobItem.createMany({
    data: productIds.map((productId) => ({
      jobId: aiJob.id,
      productId,
      itemType: types.join(','),
      status: 'pending',
    })),
  })

  const jobData: BackfillJobData = {
    aiJobId: aiJob.id,
    productIds,
    types,
    createdBy: triggeredBy,
  }
  await backfillQueue.add('backfill-products', jobData, {
    jobId: aiJob.id,
    priority: 1,
  })

  return aiJob.id
}
