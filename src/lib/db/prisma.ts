/**
 * @file prisma.ts
 * @description Prisma client singleton
 * @module lib/db
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  const sep = raw.includes('?') ? '&' : '?'
  if (raw.includes('connection_limit')) return raw
  return `${raw}${sep}connection_limit=5`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: buildDatasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
