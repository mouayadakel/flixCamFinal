/**
 * Unit tests for CartService
 */

import { CartService } from '../cart.service'
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cart: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    cartItem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    equipment: { findFirst: jest.fn() },
    studio: { findFirst: jest.fn() },
    kit: { findFirst: jest.fn() },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('CartService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getOrCreateCart', () => {
    it('creates new cart when none exists', async () => {
      ;(mockPrisma.cart.findFirst as jest.Mock).mockResolvedValue(null)
      ;(mockPrisma.cart.create as jest.Mock).mockResolvedValue({
        id: 'cart-1',
        userId: null,
        sessionId: 'sess-1',
        couponCode: null,
        discountAmount: new Decimal(0),
        subtotal: new Decimal(0),
        total: new Decimal(0),
        expiresAt: new Date(),
        items: [],
      } as any)
      const result = await CartService.getOrCreateCart(null, 'sess-1')
      expect(result).toBeDefined()
      expect(result.id).toBe('cart-1')
      expect(mockPrisma.cart.create).toHaveBeenCalled()
    })

    it('returns existing cart when valid', async () => {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      ;(mockPrisma.cart.findFirst as jest.Mock).mockResolvedValue({
        id: 'cart-1',
        userId: null,
        sessionId: 'sess-1',
        couponCode: null,
        discountAmount: new Decimal(0),
        subtotal: new Decimal(0),
        total: new Decimal(0),
        expiresAt,
        items: [],
      } as any)
      const result = await CartService.getOrCreateCart(null, 'sess-1')
      expect(result.id).toBe('cart-1')
      expect(mockPrisma.cart.create).not.toHaveBeenCalled()
    })
  })
})
