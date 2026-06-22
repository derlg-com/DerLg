import type { Metadata } from 'next'
import { HomeFeed } from '@/components/trips/HomeFeed'

export const metadata: Metadata = {
  title: 'DerLg — Discover Cambodia trips',
  description: 'Browse curated Cambodia trip packages — temples, nature, culture, adventure, and food.',
}

export default function HomePage() {
  return <HomeFeed />
}
