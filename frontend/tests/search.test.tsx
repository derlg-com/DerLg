import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { countResults } from '@/components/search/SearchView'
import { SearchResultCard } from '@/components/search/SearchResultCard'
import type { SearchResults } from '@/types/catalog'

function emptyResults(): SearchResults {
  return {
    trips: { items: [], total: 0 },
    places: { items: [], total: 0 },
    hotels: { items: [], total: 0 },
    guides: { items: [], total: 0 },
  }
}

describe('search', () => {
  it('countResults sums every group', () => {
    expect(countResults(emptyResults())).toBe(0)
    const data = emptyResults()
    data.hotels = { items: [{ id: 'h1', name: 'Hotel', coverImageUrl: null }], total: 1 }
    data.guides = { items: [{ id: 'g1', name: 'Guide', profilePicture: null }], total: 1 }
    expect(countResults(data)).toBe(2)
  })

  it('SearchResultCard links when href is given', () => {
    render(<SearchResultCard href="/hotels/h1" imageUrl={null} title="Sokha Hotel" subtitle="Siem Reap" />)
    expect(screen.getByText('Sokha Hotel')).toBeInTheDocument()
    expect(screen.getByText('Siem Reap')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/hotels/h1')
  })

  it('SearchResultCard renders without a link when href is omitted', () => {
    render(<SearchResultCard imageUrl={null} title="Angkor Wat" />)
    expect(screen.getByText('Angkor Wat')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
