import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EntityCard } from '@/components/shared/EntityCard'
import { CatalogShell } from '@/components/shared/CatalogShell'

describe('EntityCard', () => {
  it('renders title, price, badge and links to href', () => {
    render(
      <EntityCard
        href="/trips/t1"
        title="Angkor Sunrise"
        priceLabel="$120"
        priceSuffix="/ person"
        badge={{ label: 'Temples' }}
        rating={{ average: 4.8, count: 410 }}
        favorite={{ type: 'trip', id: 't1' }}
        subtitle="Siem Reap"
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/trips/t1')
    expect(screen.getByRole('heading', { name: 'Angkor Sunrise' })).toBeInTheDocument()
    expect(screen.getByText('$120')).toBeInTheDocument()
    expect(screen.getByText('Temples')).toBeInTheDocument()
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('Siem Reap')).toBeInTheDocument()
    // favorite control present
    expect(screen.getByRole('button', { name: /wishlist/i })).toBeInTheDocument()
  })

  it('omits price block when no price/meta', () => {
    render(<EntityCard href="/x" title="Bare" />)
    expect(screen.getByRole('heading', { name: 'Bare' })).toBeInTheDocument()
  })
})

describe('CatalogShell', () => {
  it('shows skeletons while loading', () => {
    const { container } = render(<CatalogShell state="loading" />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('renders the error slot in error state', () => {
    render(<CatalogShell state="error" error={<p>Boom</p>} />)
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })

  it('renders the empty slot in empty state', () => {
    render(<CatalogShell state="empty" empty={<p>Nothing here</p>} />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders children + pagination + filters in ready state', () => {
    render(
      <CatalogShell
        state="ready"
        filters={<div>FILTERS</div>}
        toolbar={<div>12 results</div>}
        pagination={<nav>PAGER</nav>}
      >
        <div>CARD</div>
      </CatalogShell>,
    )
    expect(screen.getByText('FILTERS')).toBeInTheDocument()
    expect(screen.getByText('12 results')).toBeInTheDocument()
    expect(screen.getByText('CARD')).toBeInTheDocument()
    expect(screen.getByText('PAGER')).toBeInTheDocument()
  })
})
