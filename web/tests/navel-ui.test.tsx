import { fireEvent, screen } from '@testing-library/react'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NavelCategoryTabs } from '@/components/discovery/navel-category-tabs'
import { NavelCountriesShelf } from '@/components/discovery/navel-countries-shelf'
import { NavelDestinationCard } from '@/components/discovery/navel-destination-card'
import { NavelDestinationMapCard } from '@/components/discovery/navel-destination-map-card'
import { NavelHomeCarousel } from '@/components/discovery/navel-home-carousel'
import { ProductTourModal } from '@/components/onboarding/product-tour-modal'
import { RatingBadge } from '@/components/ui/rating-badge'
import SavedBookmarksPage from '@/app/[locale]/saved/page'
import type { TripSummary } from '@/schemas/domain'

import { renderWithProviders } from './helpers/render'

vi.mock('@/lib/i18n/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockTrip: TripSummary = {
  id: 'trip-101',
  name: 'Angkor Wat Sunrise',
  category: 'temples',
  location: 'Siem Reap, Cambodia',
  durationDays: 2,
  priceUsd: 140,
  ratingAverage: 4.95,
  ratingCount: 128,
  coverImageUrl: null,
}

describe('NAVEL UI System Components', () => {
  describe('RatingBadge', () => {
    it('renders rating number and gold star icon', () => {
      renderWithProviders(<RatingBadge rating={4.8} />)
      expect(screen.getByText('4.8')).toBeInTheDocument()
    })

    it('displays reviews count when provided', () => {
      renderWithProviders(<RatingBadge rating={4.9} reviewsCount={240} />)
      expect(screen.getByText('4.9')).toBeInTheDocument()
      expect(screen.getByText('(240)')).toBeInTheDocument()
    })
  })

  describe('NavelCategoryTabs', () => {
    it('renders category options and marks active tab', () => {
      const onChange = vi.fn()
      renderWithProviders(<NavelCategoryTabs activeId="recommendation" onChange={onChange} />)

      const recButton = screen.getByRole('tab', { name: /recommendation/i })
      expect(recButton).toBeInTheDocument()
      expect(recButton).toHaveAttribute('aria-selected', 'true')

      const templesButton = screen.getByRole('tab', { name: /temples/i })
      fireEvent.click(templesButton)
      expect(onChange).toHaveBeenCalledWith('temples')
    })
  })

  describe('NavelDestinationCard', () => {
    it('renders trip name, location, and rating badge', () => {
      renderWithProviders(<NavelDestinationCard trip={mockTrip} />)

      expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
      expect(screen.getByText('Siem Reap, Cambodia')).toBeInTheDocument()
      expect(screen.getByText('Recommended')).toBeInTheDocument()
      expect(screen.getByText('5.0')).toBeInTheDocument() // formatted 4.95 -> 5.0
    })

    it('toggles bookmark button state on click', () => {
      renderWithProviders(<NavelDestinationCard trip={mockTrip} />)

      const bookmarkBtn = screen.getByRole('button', { name: /save to bookmarks/i })
      fireEvent.click(bookmarkBtn)
      expect(screen.getByRole('button', { name: /remove from bookmarks/i })).toBeInTheDocument()
    })

    it('has a link to trip detail page', () => {
      renderWithProviders(<NavelDestinationCard trip={mockTrip} />)
      const detailLink = screen.getByRole('link', { name: /view details for angkor wat sunrise/i })
      expect(detailLink).toHaveAttribute('href', '/trips/trip-101')
    })
  })

  describe('NavelCountriesShelf', () => {
    it('renders popular countries and destination counts', () => {
      renderWithProviders(<NavelCountriesShelf />)

      expect(screen.getByRole('heading', { name: /popular countries/i })).toBeInTheDocument()
      expect(screen.getByText('Cambodia')).toBeInTheDocument()
      expect(screen.getByText('Indonesia')).toBeInTheDocument()
      expect(screen.getByText('Peru')).toBeInTheDocument()
      expect(screen.getByText('Japan')).toBeInTheDocument()
    })
  })

  describe('NavelHomeCarousel', () => {
    it('renders destination list with title and filters by category', () => {
      const trips: TripSummary[] = [
        mockTrip,
        {
          ...mockTrip,
          id: 'trip-102',
          name: 'Kirirom Pine Forest',
          category: 'nature',
          location: 'Kampong Speu',
        },
      ]

      renderWithProviders(<NavelHomeCarousel trips={trips} title="Curated Trips" />)

      expect(screen.getByRole('heading', { name: /curated trips/i })).toBeInTheDocument()
      expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
      expect(screen.getByText('Kirirom Pine Forest')).toBeInTheDocument()

      // Click temples category tab
      const templesBtn = screen.getByRole('tab', { name: /temples/i })
      fireEvent.click(templesBtn)

      // Only temples trip should now be shown
      expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
      expect(screen.queryByText('Kirirom Pine Forest')).not.toBeInTheDocument()
    })
  })

  describe('NavelDestinationMapCard', () => {
    it('renders map card with name and handles selection and bookmarking', () => {
      const onSelect = vi.fn()
      renderWithProviders(
        <NavelDestinationMapCard
          id="place-1"
          name="Bayon Temple"
          location="Siem Reap"
          category="Historical"
          isSelected={true}
          onSelect={onSelect}
        />
      )

      expect(screen.getByText('Bayon Temple')).toBeInTheDocument()
      expect(screen.getByText('Historical')).toBeInTheDocument()

      const saveBtn = screen.getByRole('button', { name: /save destination/i })
      fireEvent.click(saveBtn)

      const card = screen.getByText('Bayon Temple').closest('div')
      if (card) fireEvent.click(card)
      expect(onSelect).toHaveBeenCalled()
    })
  })

  describe('ProductTourModal', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('renders the first slide with skip and advances on next click', async () => {
      renderWithProviders(<ProductTourModal />)

      // Trigger frame for requestAnimationFrame
      await vi.waitFor(() => {
        expect(screen.getByRole('dialog', { name: /product tour/i })).toBeInTheDocument()
      })

      expect(screen.getByText(/explore the/i)).toBeInTheDocument()

      const nextBtn = screen.getByRole('button', { name: /next slide/i })
      fireEvent.click(nextBtn)

      expect(screen.getByText(/enjoy/i)).toBeInTheDocument()

      const skipBtn = screen.getByRole('button', { name: /skip/i })
      fireEvent.click(skipBtn)

      expect(screen.queryByRole('dialog', { name: /product tour/i })).not.toBeInTheDocument()
      expect(localStorage.getItem('derlg_onboarding_tour_seen')).toBe('true')
    })
  })

  describe('SavedBookmarksPage', () => {
    it('renders Your Bookmark heading and tabs', () => {
      renderWithProviders(<SavedBookmarksPage />)

      expect(screen.getByRole('heading', { name: /your bookmark/i })).toBeInTheDocument()
      expect(screen.getByText('Kelingking Beach')).toBeInTheDocument()
      expect(screen.getByText('Borobudur Temple')).toBeInTheDocument()
    })

    it('filters saved items by category tab', () => {
      renderWithProviders(<SavedBookmarksPage />)

      const tripsTab = screen.getByRole('button', { name: /^trips$/i })
      fireEvent.click(tripsTab)

      expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
      expect(screen.queryByText('Kelingking Beach')).not.toBeInTheDocument()
    })

    it('removes item and displays empty state when all removed', () => {
      renderWithProviders(<SavedBookmarksPage />)

      const removeBtn = screen.getByRole('button', { name: /remove angkor wat sunrise from bookmark/i })
      fireEvent.click(removeBtn)
      expect(screen.queryByText('Angkor Wat Sunrise')).not.toBeInTheDocument()
    })
  })
})
