import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchView } from '@/components/search/SearchView'

export const metadata: Metadata = {
  title: 'Search — DerLg',
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  )
}
