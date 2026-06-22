import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { TripItinerary } from '@/components/trips/TripItinerary'
import { CurrencySelector } from '@/components/trips/CurrencySelector'
import { useCurrency } from '@/hooks/use-currency'
import { usePreferencesStore } from '@/stores/preferences.store'

describe('TripItinerary', () => {
  it('renders a row per day with its description', () => {
    render(
      <TripItinerary
        days={[
          { dayNumber: 1, title: 'Angkor Wat', description: 'Sunrise tour' },
          { dayNumber: 2, title: 'Bayon', description: 'Faces temple' },
        ]}
      />,
    )
    expect(screen.getByText('Sunrise tour')).toBeInTheDocument()
    expect(screen.getByText('Faces temple')).toBeInTheDocument()
  })

  it('renders nothing when there are no days', () => {
    const { container } = render(<TripItinerary days={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('useCurrency + CurrencySelector', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ currency: null })
    window.localStorage.clear()
  })

  it('defaults to USD for the en locale', () => {
    const { result } = renderHook(() => useCurrency())
    expect(result.current).toBe('USD')
  })

  it('CurrencySelector updates the preferences store', () => {
    render(<CurrencySelector />)
    const select = screen.getByLabelText('Currency') as HTMLSelectElement
    expect(select.value).toBe('USD')
    fireEvent.change(select, { target: { value: 'KHR' } })
    expect(usePreferencesStore.getState().currency).toBe('KHR')
  })
})
