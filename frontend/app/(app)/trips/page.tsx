import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TripsCatalog } from '@/components/trips/TripsCatalog'

export const metadata: Metadata = {
  title: 'Trips — DerLg',
  description: 'Browse and filter Cambodia trip packages by category and price.',
}

export default function TripsPage() {
  return (
    <Suspense fallback={null}>
      <TripsCatalog />
    </Suspense>
  )
}
