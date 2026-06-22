import { describe, it, expect } from 'vitest'
import { getActiveTab, shouldShowBack, TABS } from '@/lib/nav'

describe('lib/nav', () => {
  it('maps catalog + detail routes to the Home tab', () => {
    expect(getActiveTab('/')).toBe('home')
    expect(getActiveTab('/trips')).toBe('home')
    expect(getActiveTab('/trips/abc-123')).toBe('home')
    expect(getActiveTab('/hotels/xyz')).toBe('home')
    expect(getActiveTab('/transportation')).toBe('home')
    expect(getActiveTab('/guides/g1')).toBe('home')
  })

  it('maps the other tabs correctly', () => {
    expect(getActiveTab('/search')).toBe('explore')
    expect(getActiveTab('/bookings')).toBe('bookings')
    expect(getActiveTab('/checkout/b1')).toBe('bookings')
    expect(getActiveTab('/vibe-booking')).toBe('chat')
    expect(getActiveTab('/profile/edit')).toBe('profile')
    expect(getActiveTab('/ui-kit')).toBeNull()
  })

  it('shows back only on non-tab-root routes', () => {
    expect(shouldShowBack('/')).toBe(false)
    expect(shouldShowBack('/search')).toBe(false)
    expect(shouldShowBack('/bookings')).toBe(false)
    expect(shouldShowBack('/trips')).toBe(true)
    expect(shouldShowBack('/trips/abc')).toBe(true)
    expect(shouldShowBack('/checkout/b1')).toBe(true)
  })

  it('exposes 5 tabs in order', () => {
    expect(TABS.map((t) => t.key)).toEqual(['home', 'explore', 'bookings', 'chat', 'profile'])
  })
})
