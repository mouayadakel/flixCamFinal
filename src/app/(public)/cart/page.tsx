/**
 * Cart page (Phase 3.1): list, summary, coupon.
 * CartStudioSync reads ?studio=&date=&start=&duration=&package=&addOn= and adds studio to cart.
 */

'use client'

import { useLocale } from '@/hooks/use-locale'
import { CartList } from '@/components/features/cart/cart-list'
import { CartStudioSync } from '@/components/features/cart/cart-studio-sync'

export default function CartPage() {
  const { t } = useLocale()

  return (
    <main className="container px-4 py-8 pb-24 lg:pb-8">
      <CartStudioSync />
      <h1 className="mb-6 text-2xl font-bold">{t('cart.title')}</h1>
      <CartList />
    </main>
  )
}
