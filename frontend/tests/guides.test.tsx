import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GuideCard } from '@/components/guides/GuideCard'
import { VehicleCard } from '@/components/transportation/VehicleCard'
import { useFavoritesStore } from '@/stores/favorites.store'
import type { GuideSummary, VehicleSummary } from '@/types/catalog'

const guide: GuideSummary = {
  id: 'g1',
  name: 'Dara Sok',
  profilePicture: null,
  languages: ['EN', 'ZH'],
  specialties: ['Temples'],
  location: 'Siem Reap',
  gender: 'Male',
  pricePerDayUsd: 80,
  isVerified: true,
  ratingAverage: 4.9,
  ratingCount: 50,
}

const vehicle: VehicleSummary = {
  id: 'v1',
  type: 'Van',
  name: 'Toyota HiAce',
  capacity: 12,
  pricePerDayUsd: 90,
  imageUrls: [],
  amenities: [],
  ratingAverage: 4.5,
  ratingCount: 20,
}

describe('GuideCard', () => {
  beforeEach(() => useFavoritesStore.setState({ ids: [] }))
  it('renders name, languages, price, verified badge, and links to detail', () => {
    render(<GuideCard guide={guide} />)
    expect(screen.getByText('Dara Sok')).toBeInTheDocument()
    expect(screen.getByText('EN · ZH')).toBeInTheDocument()
    expect(screen.getByText('$80.00')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/guides/g1')
  })
})

describe('VehicleCard', () => {
  beforeEach(() => useFavoritesStore.setState({ ids: [] }))
  it('renders name, seats, price, and links to detail', () => {
    render(<VehicleCard vehicle={vehicle} />)
    expect(screen.getByText('Toyota HiAce')).toBeInTheDocument()
    expect(screen.getByText('12 seats')).toBeInTheDocument()
    expect(screen.getByText('$90.00')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/transportation/v1')
  })
})
