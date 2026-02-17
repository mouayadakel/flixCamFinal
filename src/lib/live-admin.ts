/**
 * @file live-admin.ts
 * @description Publish admin live events to Redis for SSE streaming (bookings, payments, etc.)
 * @module lib
 */

import { getRedisClient } from '@/lib/queue/redis.client'

const CHANNEL = 'admin:live'

export interface AdminLiveEvent {
  event: string
  payload: Record<string, unknown>
  t: number
}

/**
 * Publish an event to admin live stream (Redis pub/sub). No-op if Redis unavailable.
 */
export function publishAdminLive(event: string, payload: Record<string, unknown>): void {
  try {
    const redis = getRedisClient()
    const message: AdminLiveEvent = { event, payload, t: Date.now() }
    redis.publish(CHANNEL, JSON.stringify(message)).catch(() => {})
  } catch {
    // Redis not configured or error
  }
}

export { CHANNEL as ADMIN_LIVE_CHANNEL }
