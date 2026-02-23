/**
 * Unit tests for product-equipment-sync.service (syncEquipmentToProduct gallery padding and behavior)
 */

import { syncEquipmentToProduct } from '../product-equipment-sync.service'
import { prisma } from '@/lib/db/prisma'
import { NotFoundError } from '@/lib/errors'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    equipment: { findFirst: jest.fn() },
    translation: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (tx: any) => Promise<void>) => cb(mockTx)),
  },
}))

const mockTx = {
  product: {
    upsert: jest.fn().mockResolvedValue({}),
  },
  productTranslation: {
    upsert: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue(null),
  },
}

const mockFindFirst = prisma.equipment.findFirst as jest.Mock

describe('product-equipment-sync.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTx.product.upsert.mockResolvedValue({})
    mockTx.productTranslation.upsert.mockResolvedValue({})
  })

  describe('syncEquipmentToProduct', () => {
    it('throws NotFoundError when equipment not found', async () => {
      mockFindFirst.mockResolvedValue(null)
      await expect(syncEquipmentToProduct('missing-id')).rejects.toThrow(NotFoundError)
      await expect(syncEquipmentToProduct('missing-id')).rejects.toThrow('Equipment')
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('throws when equipment has no brand', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'eq-1',
        deletedAt: null,
        brandId: null,
        sku: 'SKU1',
        model: 'Model',
        categoryId: 'cat-1',
        dailyPrice: 10,
        weeklyPrice: null,
        monthlyPrice: null,
        media: [],
      } as any)
      await expect(syncEquipmentToProduct('eq-1')).rejects.toThrow('brand')
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('uses only real gallery images when equipment has 0 media', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'eq-1',
        deletedAt: null,
        brandId: 'brand-1',
        sku: 'SKU1',
        model: 'Model',
        categoryId: 'cat-1',
        dailyPrice: 10,
        weeklyPrice: null,
        monthlyPrice: null,
        media: [],
      } as any)
      await syncEquipmentToProduct('eq-1')
      expect(mockTx.product.upsert).toHaveBeenCalledTimes(1)
      const upsertCall = mockTx.product.upsert.mock.calls[0][0]
      const galleryImages = upsertCall.create.galleryImages as string[]
      expect(Array.isArray(galleryImages)).toBe(true)
      expect(galleryImages.length).toBe(0)
    })

    it('uses only real gallery images when equipment has 1 media', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'eq-1',
        deletedAt: null,
        brandId: 'brand-1',
        sku: 'SKU1',
        model: 'Model',
        categoryId: 'cat-1',
        dailyPrice: 10,
        weeklyPrice: null,
        monthlyPrice: null,
        media: [{ url: 'https://example.com/1.jpg' }],
      } as any)
      await syncEquipmentToProduct('eq-1')
      expect(mockTx.product.upsert).toHaveBeenCalledTimes(1)
      const upsertCall = mockTx.product.upsert.mock.calls[0][0]
      const galleryImages = upsertCall.create.galleryImages as string[]
      expect(galleryImages.length).toBe(1)
    })

    it('preserves all gallery images when equipment has 4 media', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'eq-1',
        deletedAt: null,
        brandId: 'brand-1',
        sku: 'SKU1',
        model: 'Model',
        categoryId: 'cat-1',
        dailyPrice: 10,
        weeklyPrice: null,
        monthlyPrice: null,
        media: [
          { url: 'https://example.com/1.jpg' },
          { url: 'https://example.com/2.jpg' },
          { url: 'https://example.com/3.jpg' },
          { url: 'https://example.com/4.jpg' },
        ],
      } as any)
      await syncEquipmentToProduct('eq-1')
      expect(mockTx.product.upsert).toHaveBeenCalledTimes(1)
      const upsertCall = mockTx.product.upsert.mock.calls[0][0]
      const galleryImages = upsertCall.create.galleryImages as string[]
      expect(galleryImages.length).toBe(4)
    })

    it('upserts product and 3 product translations', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'eq-1',
        deletedAt: null,
        brandId: 'brand-1',
        sku: 'SKU1',
        model: 'Model',
        categoryId: 'cat-1',
        dailyPrice: 10,
        weeklyPrice: null,
        monthlyPrice: null,
        media: [{ url: 'https://example.com/1.jpg' }],
      } as any)
      await syncEquipmentToProduct('eq-1')
      expect(mockTx.product.upsert).toHaveBeenCalledTimes(1)
      expect(mockTx.productTranslation.upsert).toHaveBeenCalledTimes(3)
    })
  })
})
