import type { Metadata } from 'next'
import { HotelsCatalog } from '@/components/hotels/HotelsCatalog'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Hotels — DerLg',
  description: 'Find and book hotels across Cambodia.',
  keywords: ['Cambodia hotels', 'Siem Reap hotels', 'Phnom Penh hotels', 'accommodation'],
  alternates: { canonical: absoluteUrl('/hotels') },
}

export default function HotelsPage() {
  return <HotelsCatalog />
}
