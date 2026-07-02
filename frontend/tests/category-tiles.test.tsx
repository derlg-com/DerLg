import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryTiles } from '@/components/explore/category-tiles'
import { TRIP_CATEGORIES } from '@/types/catalog'

// Home-screen category navigation (Requirements 3.6, 3.7).
// 3.6: display a categories section with icons for Temples, Nature, Culture,
//      Adventure, and Food.
// 3.7: clicking a category navigates to the filtered trips list, pre-filtered
//      by that category (?category=<Category>).
describe('CategoryTiles', () => {
  it('renders a tile for every trip category with its localized label (Req 3.6)', () => {
    render(<CategoryTiles />)
    // Five categories exactly — no more, no fewer.
    expect(TRIP_CATEGORIES).toHaveLength(5)
    for (const category of TRIP_CATEGORIES) {
      expect(screen.getByText(category)).toBeInTheDocument()
    }
  })

  it('renders each category as a link pre-filtered by that category (Req 3.7)', () => {
    render(<CategoryTiles />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(TRIP_CATEGORIES.length)

    for (const category of TRIP_CATEGORIES) {
      const link = screen.getByRole('link', { name: category })
      expect(link).toHaveAttribute('href', `/trips?category=${category}`)
    }
  })

  it('exposes an accessible name on each tile via its visible label (Req 3.6)', () => {
    render(<CategoryTiles />)
    // Each link's accessible name is the visible category label; the icon is
    // decorative (aria-hidden) so it must not contribute a second name.
    for (const category of TRIP_CATEGORIES) {
      expect(screen.getByRole('link', { name: category })).toBeInTheDocument()
    }
  })
})
