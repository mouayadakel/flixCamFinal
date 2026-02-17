/**
 * @file backfill.queue.ts
 * @description BullMQ queue for content backfill jobs (AI fill for products with gaps)
 * @module lib/queue
 */

import { Queue } from 'bullmq'
import { getRedisClient } from './redis.client'
import { prisma } from '@/lib/db/prisma'
import { AiJobType, JobStatus } from '@prisma/client'

export const BACKFILL_QUEUE_NAME = 'backfill'

export const backfillQueue = new Queue(BACKFILL_QUEUE_NAME, {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 50,
    },
  },
})

export interface BackfillJobData {
  aiJobId: string
  productIds: string[]
  types?: Array<'text' | 'photo' | 'spec'>
  createdBy?: string
  provider?: 'openai' | 'gemini'
}

/**
 * Add a backfill job to the queue and create AiJob record (new schema: AiJobType, JobStatus, totalItems).
 */
export async function addBackfillJob(
  productIds: string[],
  options?: { createdBy?: string; provider?: 'openai' | 'gemini'; types?: Array<'text' | 'photo' | 'spec'> }
): Promise<{ jobId: string; queued: number; estimatedMinutes: number }> {
  if (productIds.length === 0) {
    return { jobId: '', queued: 0, estimatedMinutes: 0 }
  }

  const types = options?.types ?? ['text']
  const jobType: AiJobType =
    types.length === 3 ? AiJobType.FULL_BACKFILL : types.includes('photo') ? AiJobType.PHOTO_BACKFILL : types.includes('spec') ? AiJobType.SPEC_BACKFILL : AiJobType.TEXT_BACKFILL

  const aiJob = await prisma.aiJob.create({
    data: {
      type: jobType,
      status: JobStatus.PENDING,
      triggeredBy: 'manual',
      totalItems: productIds.length,
      metadata: options?.createdBy ? { triggeredBy: options.createdBy } : undefined,
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

  await backfillQueue.add(
    'backfill-products',
    {
      aiJobId: aiJob.id,
      productIds,
      types,
      createdBy: options?.createdBy,
      provider: options?.provider,
    } satisfies BackfillJobData,
    {
      jobId: aiJob.id,
      priority: 1,
    }
  )

  const estimatedMinutes = Math.max(1, Math.ceil(productIds.length / 5))
  return {
    jobId: aiJob.id,
    queued: productIds.length,
    estimatedMinutes,
  }
}
