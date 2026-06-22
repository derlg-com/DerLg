import type { Metadata } from 'next'
import { HotelsCatalog } from '@/components/hotels/HotelsCatalog'

export const metadata: Metadata = {
  title: 'Hotels — DerLg',
  description: 'Find and book hotels across Cambodia.',
}

export default function HotelsPage() {
  return <HotelsCatalog />
}
