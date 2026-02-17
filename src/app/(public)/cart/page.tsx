/**
 * Cart page (Phase 3.1): list, summary, coupon.
 */

'use client'

import { useLocale } from '@/hooks/use-locale'
import { CartList } from '@/components/features/cart/cart-list'

export default function CartPage() {
  const { t } = useLocale()

  return (
    <main className="container px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('cart.title')}</h1>
      <CartList />
    </main>
  )
}
