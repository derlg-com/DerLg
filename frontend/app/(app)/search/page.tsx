import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchView } from '@/components/search/SearchView'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Search — DerLg',
  description: 'Search trips, hotels, guides, transportation, and festivals across Cambodia.',
  alternates: { canonical: absoluteUrl('/search') },
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  )
}
