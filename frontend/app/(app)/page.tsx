import type { Metadata } from 'next'
import { ExploreLanding } from '@/components/explore/explore-landing'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'DerLg — Discover Cambodia trips',
  description:
    'Plan, book, and explore Cambodia — curated trips, hotels, transport, and guides, with an AI concierge.',
  keywords: [
    'Cambodia travel',
    'Cambodia trips',
    'Angkor tours',
    'hotels',
    'tour guides',
    'AI concierge',
  ],
  alternates: { canonical: absoluteUrl('/') },
}

export default function HomePage() {
  return <ExploreLanding />
}
