import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TripsCatalog } from '@/components/trips/TripsCatalog'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Trips — DerLg',
  description: 'Browse and filter Cambodia trip packages by category and price.',
  keywords: ['Cambodia trips', 'tour packages', 'Angkor Wat tours', 'travel packages'],
  alternates: { canonical: absoluteUrl('/trips') },
}

export default function TripsPage() {
  return (
    <Suspense fallback={null}>
      <TripsCatalog />
    </Suspense>
  )
}
