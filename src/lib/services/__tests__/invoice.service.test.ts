/**
 * Invoice math tests — calculation formula validation.
 * Tests: subtotal → discount → tax → total
 */

describe('Invoice Math — calculateTotals', () => {
  function calculateTotals(
    items: Array<{ description: string; quantity: number; unitPrice: number; days?: number }>,
    discount: number = 0,
    vatRate: number = 0.15
  ): {
    subtotal: number
    vatAmount: number
    totalAmount: number
    itemTotals: number[]
  } {
    const itemTotals = items.map((item) => {
      const days = item.days ?? 1
      return Math.round(item.quantity * days * item.unitPrice * 100) / 100
    })
    const subtotal = Math.round(itemTotals.reduce((sum, t) => sum + t, 0) * 100) / 100
    const taxableAmount = Math.max(0, subtotal - discount)
    const vatAmount = Math.round(taxableAmount * vatRate * 100) / 100
    const totalAmount = Math.round((taxableAmount + vatAmount) * 100) / 100
    return { subtotal, vatAmount, totalAmount, itemTotals }
  }

  test('Test 1: No discount, no tax (0% VAT) — subtotal = grand total', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 1, unitPrice: 1000 }],
      0,
      0
    )
    expect(result.subtotal).toBe(1000)
    expect(result.vatAmount).toBe(0)
    expect(result.totalAmount).toBe(1000)
  })

  test('Test 2: 10% discount, no tax — subtotal 1000, discount 100, total 900', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 1, unitPrice: 1000 }],
      100,
      0
    )
    expect(result.subtotal).toBe(1000)
    expect(result.totalAmount).toBe(900)
  })

  test('Test 3: 15% VAT on post-discount amount — taxable 900, tax 135, total 1035', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 1, unitPrice: 1000 }],
      100,
      0.15
    )
    expect(result.subtotal).toBe(1000)
    expect(result.vatAmount).toBe(135)
    expect(result.totalAmount).toBe(1035)
  })

  test('Test 4: Discount + Tax combined — subtotal 1000, 10% disc → 900, 15% tax → 135, total 1035', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 1, unitPrice: 1000 }],
      100,
      0.15
    )
    expect(result.vatAmount).toBe(135)
    expect(result.totalAmount).toBe(1035)
  })

  test('Test 5: Balance due = grand total - amount paid', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 1, unitPrice: 1000 }],
      0,
      0.15
    )
    const amountPaid = 500
    const balanceDue = Math.round((result.totalAmount - amountPaid) * 100) / 100
    expect(balanceDue).toBe(650)
  })

  test('Test 6: 100% payment — balance due = 0', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 1, unitPrice: 1000 }],
      0,
      0.15
    )
    const amountPaid = result.totalAmount
    const balanceDue = Math.round((result.totalAmount - amountPaid) * 100) / 100
    expect(balanceDue).toBe(0)
    const isPaid = balanceDue <= 0
    expect(isPaid).toBe(true)
  })

  test('Test 7: Partial payment — balance due = correct remainder', () => {
    const result = calculateTotals(
      [{ description: 'Camera', quantity: 2, unitPrice: 500, days: 3 }],
      200,
      0.15
    )
    // Subtotal: 2 * 3 * 500 = 3000
    // Taxable: 3000 - 200 = 2800
    // VAT: 2800 * 0.15 = 420
    // Total: 2800 + 420 = 3220
    expect(result.subtotal).toBe(3000)
    expect(result.vatAmount).toBe(420)
    expect(result.totalAmount).toBe(3220)

    const amountPaid = 1000
    const balanceDue = Math.round((result.totalAmount - amountPaid) * 100) / 100
    expect(balanceDue).toBe(2220)
  })

  test('Test 8: Discount cannot make subtotal negative — Math.max(0, subtotal - discount)', () => {
    const result = calculateTotals(
      [{ description: 'Small item', quantity: 1, unitPrice: 50 }],
      200,
      0.15
    )
    // Subtotal: 50, discount: 200 → taxable = max(0, 50-200) = 0
    expect(result.subtotal).toBe(50)
    expect(result.vatAmount).toBe(0)
    expect(result.totalAmount).toBe(0)
  })

  test('Test 9: Late return fee added as line item — appears correctly in totals', () => {
    const result = calculateTotals(
      [
        { description: 'Camera Rental', quantity: 1, unitPrice: 500, days: 5 },
        { description: 'Late Return Fee (2 days × 150%)', quantity: 1, unitPrice: 1500 },
      ],
      0,
      0.15
    )
    // Camera: 1 * 5 * 500 = 2500
    // Late fee: 1 * 1 * 1500 = 1500
    // Subtotal: 4000
    // VAT: 4000 * 0.15 = 600
    // Total: 4600
    expect(result.subtotal).toBe(4000)
    expect(result.vatAmount).toBe(600)
    expect(result.totalAmount).toBe(4600)
    expect(result.itemTotals).toEqual([2500, 1500])
  })

  test('Test 10: All amounts are integers-safe (no floating-point drift)', () => {
    const result = calculateTotals(
      [
        { description: 'Item A', quantity: 3, unitPrice: 33.33, days: 7 },
        { description: 'Item B', quantity: 1, unitPrice: 19.99 },
      ],
      50,
      0.15
    )
    // Item A: 3 * 7 * 33.33 = 699.93
    // Item B: 1 * 1 * 19.99 = 19.99
    // Subtotal: 719.92
    // Taxable: 719.92 - 50 = 669.92
    // VAT: 669.92 * 0.15 = 100.488 → 100.49
    // Total: 669.92 + 100.49 = 770.41
    expect(result.subtotal).toBe(719.92)
    expect(result.vatAmount).toBe(100.49)
    expect(result.totalAmount).toBe(770.41)
    expect(Number.isFinite(result.totalAmount)).toBe(true)
    expect(String(result.totalAmount).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})
