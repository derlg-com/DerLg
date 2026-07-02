import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ExploreTabs } from '@/components/explore/ExploreTabs'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Explore — DerLg',
  description: 'Browse places, festivals, and the map across Cambodia.',
  alternates: { canonical: absoluteUrl('/explore') },
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreTabs />
    </Suspense>
  )
}
