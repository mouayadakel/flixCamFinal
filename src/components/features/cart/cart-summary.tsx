/**
 * Cart summary: subtotal, discount, total, checkout CTA (Phase 3.1).
 */

'use client'

import Link from 'next/link'
import { useLocale } from '@/hooks/use-locale'
import { Button } from '@/components/ui/button'

interface CartSummaryProps {
  subtotal: number
  discountAmount: number
  total: number
  itemCount: number
}

export function CartSummary({ subtotal, discountAmount, total, itemCount }: CartSummaryProps) {
  const { t } = useLocale()

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex justify-between text-sm">
        <span>{t('cart.subtotal')}</span>
        <span>{subtotal.toLocaleString()} SAR</span>
      </div>
      {discountAmount > 0 && (
        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
          <span>{t('cart.discount')}</span>
          <span>-{discountAmount.toLocaleString()} SAR</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-2 font-semibold">
        <span>{t('cart.total')}</span>
        <span>{total.toLocaleString()} SAR</span>
      </div>
      <Button asChild className="mt-4 w-full" size="lg" disabled={itemCount === 0}>
        <Link href="/checkout">{t('cart.checkout')}</Link>
      </Button>
    </div>
  )
}
