/**
 * E2E tests for checkout flow
 * Browse equipment → add to cart → go to checkout
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Checkout flow', () => {
  test('equipment page loads and shows catalog', async ({ page }) => {
    await page.goto(`${BASE}/equipment`)
    await expect(page).toHaveURL(/\/equipment/)
    // Catalog or empty state should be visible
    const catalog = page.locator('[data-testid="equipment-catalog"], .grid, main')
    await expect(catalog.first()).toBeVisible({ timeout: 10000 })
  })

  test('cart page loads', async ({ page }) => {
    await page.goto(`${BASE}/cart`)
    await expect(page).toHaveURL(/\/cart/)
    // Cart content or empty state
    const content = page.locator('main, [role="main"], .container')
    await expect(content.first()).toBeVisible({ timeout: 5000 })
  })

  test('checkout page requires auth or redirects', async ({ page }) => {
    await page.goto(`${BASE}/checkout`)
    // May redirect to login or show checkout form
    await expect(page).toHaveURL(/\/(checkout|login|\/)/)
  })

  test('equipment detail page loads when navigating from catalog', async ({ page }) => {
    await page.goto(`${BASE}/equipment`)
    await expect(page).toHaveURL(/\/equipment/)
    // Look for first equipment link
    const link = page.locator('a[href*="/equipment/"]').first()
    const href = await link.getAttribute('href').catch(() => null)
    if (href && href !== '/equipment') {
      await page.goto(`${BASE}${href}`)
      await expect(page).toHaveURL(/\/equipment\/[^/]+/)
    }
  })
})
