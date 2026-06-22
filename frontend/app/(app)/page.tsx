import type { Metadata } from 'next'
import { ExploreLanding } from '@/components/explore/explore-landing'

export const metadata: Metadata = {
  title: 'DerLg — Discover Cambodia trips',
  description:
    'Plan, book, and explore Cambodia — curated trips, hotels, transport, and guides, with an AI concierge.',
}

export default function HomePage() {
  return <ExploreLanding />
}
