/**
 * Double-booking prevention tests.
 * Tests overlap detection and stock validation logic.
 */

describe('Double Booking Prevention', () => {
  interface BookingSlot {
    equipmentId: string
    startDate: Date
    endDate: Date
    quantity: number
    status: 'CONFIRMED' | 'ACTIVE' | 'CANCELLED'
  }

  /**
   * Pure logic check for booking overlap (mirrors the availability engine).
   */
  function hasOverlap(
    newStart: Date,
    newEnd: Date,
    existingStart: Date,
    existingEnd: Date
  ): boolean {
    return newStart < existingEnd && newEnd > existingStart
  }

  /**
   * Check if booking is possible given existing bookings and stock.
   */
  function canBook(
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    quantityRequested: number,
    totalStock: number,
    existingBookings: BookingSlot[]
  ): { allowed: boolean; reason?: string } {
    const activeBookings = existingBookings.filter(
      (b) =>
        b.equipmentId === equipmentId &&
        b.status !== 'CANCELLED' &&
        hasOverlap(startDate, endDate, b.startDate, b.endDate)
    )

    const maxConcurrentUsage = activeBookings.reduce((sum, b) => sum + b.quantity, 0)

    if (maxConcurrentUsage + quantityRequested > totalStock) {
      return {
        allowed: false,
        reason: `Insufficient stock: ${totalStock - maxConcurrentUsage} available, ${quantityRequested} requested`,
      }
    }

    return { allowed: true }
  }

  test('Test 1: Book item A Jan 1-5, then same item Jan 3-7 → REJECTED (overlap)', () => {
    const existingBookings: BookingSlot[] = [
      {
        equipmentId: 'eq-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        quantity: 1,
        status: 'CONFIRMED',
      },
    ]

    const result = canBook(
      'eq-1',
      new Date('2026-01-03'),
      new Date('2026-01-07'),
      1,
      1,
      existingBookings
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Insufficient stock')
  })

  test('Test 2: Book item A Jan 1-5, then Jan 6-10 → ALLOWED (adjacent, not overlapping)', () => {
    const existingBookings: BookingSlot[] = [
      {
        equipmentId: 'eq-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        quantity: 1,
        status: 'CONFIRMED',
      },
    ]

    const result = canBook(
      'eq-1',
      new Date('2026-01-06'),
      new Date('2026-01-10'),
      1,
      1,
      existingBookings
    )

    expect(result.allowed).toBe(true)
  })

  test('Test 3: Book item A Jan 1-5 (qty=2, stock=2), then same dates qty=1 → REJECTED', () => {
    const existingBookings: BookingSlot[] = [
      {
        equipmentId: 'eq-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        quantity: 2,
        status: 'CONFIRMED',
      },
    ]

    const result = canBook(
      'eq-1',
      new Date('2026-01-01'),
      new Date('2026-01-05'),
      1,
      2,
      existingBookings
    )

    expect(result.allowed).toBe(false)
  })

  test('Test 4: Cancel booking Jan 1-5, then re-book same dates → ALLOWED', () => {
    const existingBookings: BookingSlot[] = [
      {
        equipmentId: 'eq-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        quantity: 1,
        status: 'CANCELLED',
      },
    ]

    const result = canBook(
      'eq-1',
      new Date('2026-01-01'),
      new Date('2026-01-05'),
      1,
      1,
      existingBookings
    )

    expect(result.allowed).toBe(true)
  })

  test('Test 5: Concurrent booking simulation — two requests for same slot → only one succeeds', () => {
    const existingBookings: BookingSlot[] = []

    const result1 = canBook('eq-1', new Date('2026-03-01'), new Date('2026-03-05'), 1, 1, existingBookings)
    expect(result1.allowed).toBe(true)

    existingBookings.push({
      equipmentId: 'eq-1',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-05'),
      quantity: 1,
      status: 'CONFIRMED',
    })

    const result2 = canBook('eq-1', new Date('2026-03-01'), new Date('2026-03-05'), 1, 1, existingBookings)
    expect(result2.allowed).toBe(false)
  })
})
