/**
 * @file backfill.worker.ts
 * @description BullMQ worker for content backfill (AI fill for products with gaps)
 * @module lib/queue
 */

import { Worker, Job } from 'bullmq'
import { getRedisClient } from './redis.client'
import { prisma } from '@/lib/db/prisma'
import { AiJobType, ImageSource, JobStatus } from '@prisma/client'
import { autofillMissingFields } from '@/lib/services/ai-autofill.service'
import { scanAndQueue } from '@/lib/services/catalog-scanner.service'
import { getProductIdsWithGaps } from '@/lib/services/content-health.service'
import { inferMissingSpecs } from '@/lib/services/ai-spec-parser.service'
import { sourceImages } from '@/lib/services/photo-sourcing.service'
import { recordCost, canSpend } from '@/lib/utils/cost-tracker'
import { captureQualitySnapshot } from '@/lib/services/quality-scorer.service'
import type { BackfillJobData } from './backfill.queue'

export const BACKFILL_QUEUE_NAME = 'backfill'
const NIGHTLY_BATCH_SIZE = 50
const CONCURRENCY = 10
const BATCH_DELAY_MS = 500

function createBackfillWorker() {
  const worker = new Worker(
    BACKFILL_QUEUE_NAME,
    async (job: Job<BackfillJobData | Record<string, never>>) => {
      if (job.name === 'nightly-scan') {
        await scanAndQueue({
          types: ['text', 'photo', 'spec'],
          trigger: 'scheduled',
        })
        return
      }

      let aiJobId: string
      let productIds: string[]
      let provider: 'openai' | 'gemini'
      let types: Array<'text' | 'photo' | 'spec'>

      if (job.name === 'nightly-backfill') {
        const ids = await getProductIdsWithGaps()
        productIds = ids.slice(0, NIGHTLY_BATCH_SIZE)
        if (productIds.length === 0) return
        const aiJob = await prisma.aiJob.create({
          data: {
            type: AiJobType.TEXT_BACKFILL,
            status: JobStatus.PENDING,
            triggeredBy: 'cron',
            totalItems: productIds.length,
          },
        })
        aiJobId = aiJob.id
        provider = 'gemini'
        types = ['text']
      } else {
        const data = job.data as BackfillJobData
        aiJobId = data.aiJobId
        productIds = data.productIds ?? []
        provider = data.provider ?? 'gemini'
        types = data.types ?? ['text']
      }

      if (!aiJobId || !productIds?.length) return
      const runText = !types || types.includes('text')
      const runSpec = types?.includes('spec')
      const runPhoto = types?.includes('photo')

      await prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: JobStatus.RUNNING, startedAt: new Date() },
      })

      const estimatedCostPerProduct = runPhoto ? 0.15 : runSpec ? 0.08 : 0.05
      const estimatedCost = Math.ceil(productIds.length * estimatedCostPerProduct * 100) / 100
      const allowed = await canSpend(provider, estimatedCost)
      if (!allowed) {
        await prisma.aiJob.update({
          where: { id: aiJobId },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            errorLog: [{ error: 'Budget limit reached (daily or monthly). Increase limit in AI Settings > التكاليف.', timestamp: new Date().toISOString() }] as object,
          },
        })
        return
      }

      let processed = 0
      let succeeded = 0
      let failed = 0
      const errorLog: Array<{ productId: string; error: string; timestamp: string }> = []

      for (let i = 0; i < productIds.length; i++) {
        if (i > 0 && i % CONCURRENCY === 0) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
        }
        const productId = productIds[i]
        try {
          const product = await prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
            include: {
              translations: { where: { deletedAt: null } },
              category: true,
              brand: true,
            },
          })

          if (!product) {
            failed++
            processed++
            errorLog.push({ productId, error: 'Product not found', timestamp: new Date().toISOString() })
            await job.updateProgress({ processed, total: productIds.length, succeeded, failed })
            continue
          }

          const existingTranslations = product.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            shortDescription: t.shortDescription,
            longDescription: t.longDescription,
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
            seoKeywords: t.seoKeywords,
            specifications: t.specifications,
          }))
          const enTranslation = existingTranslations.find((t) => t.locale === 'en')

          if (runText) {
          const autofillResult = await autofillMissingFields(
            productId,
            {
              name: enTranslation?.name ?? '',
              shortDescription: enTranslation?.shortDescription,
              longDescription: enTranslation?.longDescription,
              seoTitle: enTranslation?.seoTitle,
              seoDescription: enTranslation?.seoDescription,
              seoKeywords: enTranslation?.seoKeywords,
              translations: existingTranslations,
            },
            {
              category: product.category?.name,
              brand: product.brand?.name,
              specifications: enTranslation?.specifications as Record<string, unknown> | undefined,
            },
            provider,
            { jobId: aiJobId }
          )

          if (autofillResult.seo) {
            if (enTranslation) {
              await prisma.productTranslation.updateMany({
                where: { productId, locale: 'en' },
                data: {
                  seoTitle: autofillResult.seo!.metaTitle || enTranslation.seoTitle,
                  seoDescription: autofillResult.seo!.metaDescription || enTranslation.seoDescription,
                  seoKeywords: autofillResult.seo!.metaKeywords || enTranslation.seoKeywords,
                },
              })
            }
            if (autofillResult.translations?.ar) {
              await prisma.productTranslation.upsert({
                where: { productId_locale: { productId, locale: 'ar' } },
                create: {
                  productId,
                  locale: 'ar',
                  name: autofillResult.translations.ar.name,
                  shortDescription: autofillResult.translations.ar.shortDescription,
                  longDescription: autofillResult.translations.ar.longDescription,
                  seoTitle: autofillResult.seo!.metaTitle,
                  seoDescription: autofillResult.seo!.metaDescription,
                  seoKeywords: autofillResult.seo!.metaKeywords,
                },
                update: {
                  name: autofillResult.translations.ar.name,
                  shortDescription: autofillResult.translations.ar.shortDescription,
                  longDescription: autofillResult.translations.ar.longDescription,
                  seoTitle: autofillResult.seo!.metaTitle,
                  seoDescription: autofillResult.seo!.metaDescription,
                  seoKeywords: autofillResult.seo!.metaKeywords,
                },
              })
            }
            if (autofillResult.translations?.zh) {
              await prisma.productTranslation.upsert({
                where: { productId_locale: { productId, locale: 'zh' } },
                create: {
                  productId,
                  locale: 'zh',
                  name: autofillResult.translations.zh.name,
                  shortDescription: autofillResult.translations.zh.shortDescription,
                  longDescription: autofillResult.translations.zh.longDescription,
                  seoTitle: autofillResult.seo!.metaTitle,
                  seoDescription: autofillResult.seo!.metaDescription,
                  seoKeywords: autofillResult.seo!.metaKeywords,
                },
                update: {
                  name: autofillResult.translations.zh.name,
                  shortDescription: autofillResult.translations.zh.shortDescription,
                  longDescription: autofillResult.translations.zh.longDescription,
                  seoTitle: autofillResult.seo!.metaTitle,
                  seoDescription: autofillResult.seo!.metaDescription,
                  seoKeywords: autofillResult.seo!.metaKeywords,
                },
              })
            }
          }

          }

          if (runPhoto) {
            try {
              const sourced = await sourceImages(product, 4)
              if (sourced.length > 0) {
                const existingGallery = (product.galleryImages as string[] | null) ?? []
                const newUrls = sourced.filter((s) => s.cloudinaryUrl).map((s) => s.cloudinaryUrl as string)
                const combined = [...existingGallery, ...newUrls].slice(0, 10)
                await prisma.product.update({
                  where: { id: productId },
                  data: {
                    galleryImages: combined,
                    photoStatus: combined.length >= 4 ? 'sufficient' : 'needs_sourcing',
                  },
                })
                for (const s of sourced) {
                  if (!s.cloudinaryUrl) continue
                  const imageSource =
                    s.source === 'BRAND_ASSET'
                      ? ImageSource.BRAND_ASSET
                      : s.source === 'dalle'
                        ? ImageSource.AI_GENERATED
                        : s.source === 'pexels'
                          ? ImageSource.STOCK_PHOTO
                          : ImageSource.UPLOAD
                  await prisma.productImage.create({
                    data: {
                      productId,
                      url: s.cloudinaryUrl,
                      imageSource,
                      pendingReview: s.pendingReview ?? false,
                      qualityScore: s.qualityScore ?? null,
                    },
                  })
                }
              }
            } catch (photoErr) {
              errorLog.push({
                productId,
                error: `Photo sourcing: ${photoErr instanceof Error ? photoErr.message : String(photoErr)}`,
                timestamp: new Date().toISOString(),
              })
            }
          }

          if (runSpec) {
            try {
              const specResult = await inferMissingSpecs(product)
              if (specResult.cost > 0) {
                await recordCost({ jobId: aiJobId, feature: 'spec_inference', costUsd: specResult.cost })
              }
              const toMerge = specResult.specs.filter((s) => s.confidence >= 70)
              const firstTrans = product.translations[0]
              if (toMerge.length > 0 && firstTrans) {
                const current = (firstTrans.specifications as Record<string, unknown>) ?? {}
                const next = { ...current }
                for (const s of toMerge) {
                  if (current[s.key] == null || String(current[s.key]).trim() === '') {
                    next[s.key] = s.value
                  }
                }
                await prisma.productTranslation.updateMany({
                  where: { productId },
                  data: { specifications: next },
                })
              }
            } catch (specErr) {
              errorLog.push({
                productId,
                error: `Spec inference: ${specErr instanceof Error ? specErr.message : String(specErr)}`,
                timestamp: new Date().toISOString(),
              })
            }
          }

          await prisma.product.update({
            where: { id: productId },
            data: {
              lastAiRunAt: new Date(),
              aiRunCount: { increment: 1 },
            },
          })

          succeeded++
          processed++
        } catch (err) {
          failed++
          processed++
          errorLog.push({
            productId,
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          })
        }

        await job.updateProgress({ processed, total: productIds.length, succeeded, failed })
        await prisma.aiJob.update({
          where: { id: aiJobId },
          data: { processed, succeeded, failed, errorLog: errorLog.slice(-50) as object },
        })
      }

      await prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: failed === productIds.length ? JobStatus.FAILED : JobStatus.COMPLETED,
          processed,
          succeeded,
          failed,
          completedAt: new Date(),
          errorLog: errorLog.length ? (errorLog.slice(-50) as object) : undefined,
        },
      })

      try {
        await captureQualitySnapshot()
      } catch (e) {
        console.error('[BackfillWorker] captureQualitySnapshot failed:', e)
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    }
  )

  worker.on('failed', async (job, err) => {
    if (job?.data?.aiJobId) {
      await prisma.aiJob.update({
        where: { id: job.data.aiJobId },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          errorLog: [{ error: err?.message ?? 'Worker failed', timestamp: new Date().toISOString() }] as object,
        },
      })
    }
  })

  return worker
}

let backfillWorkerInstance: Worker | null = null

export function getBackfillWorker(): Worker {
  if (!backfillWorkerInstance) {
    backfillWorkerInstance = createBackfillWorker()
  }
  return backfillWorkerInstance
}
