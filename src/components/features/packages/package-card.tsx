/**
 * Package/kit card for list (Phase 2.5).
 */

import Link from 'next/link'
import { useLocale } from '@/hooks/use-locale'

interface PackageCardProps {
  pkg: {
    id: string
    name: string
    slug: string
    description: string | null
    discountPercent: number | null
    itemCount: number
  }
}

export function PackageCard({ pkg }: PackageCardProps) {
  const { t } = useLocale()

  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <h2 className="font-semibold">{pkg.name}</h2>
      {pkg.itemCount > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">{pkg.itemCount} items</p>
      )}
      {pkg.discountPercent != null && pkg.discountPercent > 0 && (
        <span className="mt-2 inline-block text-sm font-medium text-green-600 dark:text-green-400">
          {pkg.discountPercent}% off
        </span>
      )}
    </Link>
  )
}
