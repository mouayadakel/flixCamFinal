/**
 * Rental policies – from API (admin-managed) or static fallback.
 */

import type { Metadata } from 'next'
import { PoliciesPageClient } from './policies-page-client'

export const metadata: Metadata = {
  title: 'سياسات التأجير | Rental Policies',
  description: 'شروط التأجير: التأمين، الوديعة، الهوية، رسوم التأخير، الأضرار، الإلغاء.',
}

export default function PoliciesPage() {
  return <PoliciesPageClient />
}
