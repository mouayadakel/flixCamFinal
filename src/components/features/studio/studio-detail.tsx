/**
 * Studio detail: gallery, info, booking form (Phase 2.4).
 */

'use client'

import Image from 'next/image'
import { useLocale } from '@/hooks/use-locale'
import { StudioBookingForm } from './studio-booking-form'

interface StudioDetailProps {
  studio: {
    id: string
    name: string
    slug: string
    description: string | null
    capacity: number | null
    hourlyRate: number
    media: { id: string; url: string; type: string }[]
    addOns: { id: string; name: string; price: number }[]
  }
}

export function StudioDetail({ studio }: StudioDetailProps) {
  const { t } = useLocale()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{studio.name}</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {studio.media.length > 0 ? (
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              <Image
                src={studio.media[0].url}
                alt={studio.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 66vw"
                priority
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground">
              No image
            </div>
          )}
          {studio.description && <p className="text-muted-foreground">{studio.description}</p>}
          {studio.capacity != null && <p className="text-sm">Capacity: {studio.capacity}</p>}
          {studio.addOns.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">Add-ons</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {studio.addOns.map((a) => (
                  <li key={a.id}>
                    {a.name} — {a.price.toLocaleString()} SAR
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <StudioBookingForm studioSlug={studio.slug} hourlyRate={studio.hourlyRate} />
        </div>
      </div>
    </div>
  )
}
