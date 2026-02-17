/**
 * Full FAQ page – all questions from /api/public/faq.
 */

import type { Metadata } from 'next'
import { PublicContainer } from '@/components/public/public-container'
import { FaqPageClient } from './faq-page-client'

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
  description: 'أسئلة شائعة عن تأجير المعدات والاستوديوهات في الرياض.',
}

export default function FaqPage() {
  return (
    <main className="min-h-screen py-10 md:py-14">
      <PublicContainer className="max-w-3xl">
        <FaqPageClient />
      </PublicContainer>
    </main>
  )
}
