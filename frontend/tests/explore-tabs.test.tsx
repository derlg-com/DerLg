import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ExploreTabs,
  resolveExploreTab,
  EXPLORE_TABS,
  DEFAULT_EXPLORE_TAB,
} from '@/components/explore/ExploreTabs'

// ExploreTabs is the Explore screen tab shell (task 8.1). It renders the
// Places / Festivals / Maps tabs and keeps the active tab in sync with the
// `?tab=` query param so links like /explore?tab=festivals deep-link to a tab.
// Tab content is filled by downstream tasks 8.2–8.5 (lists/filters/search/modal)
// and task 9 (map), so here we only assert the shell + tab selection.
//
// Validates: Requirements 4.1 (tabs for Places, Festivals, Maps) and 4.8
// (filter/tab selection persisted in URL query parameters).

const replace = vi.fn()
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/explore',
  useSearchParams: () => searchParams,
}))

describe('resolveExploreTab', () => {
  it('returns the default tab for missing or unknown values', () => {
    expect(resolveExploreTab(null)).toBe(DEFAULT_EXPLORE_TAB)
    expect(resolveExploreTab(undefined)).toBe(DEFAULT_EXPLORE_TAB)
    expect(resolveExploreTab('')).toBe(DEFAULT_EXPLORE_TAB)
    expect(resolveExploreTab('nope')).toBe(DEFAULT_EXPLORE_TAB)
  })

  it('passes through every known tab', () => {
    for (const tab of EXPLORE_TABS) {
      expect(resolveExploreTab(tab)).toBe(tab)
    }
  })
})

describe('ExploreTabs (tab shell)', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParams = new URLSearchParams()
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders a tab for Places, Festivals, and Maps', () => {
    render(<ExploreTabs />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(EXPLORE_TABS.length)
    expect(screen.getByRole('tab', { name: 'Places' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Festivals' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Maps' })).toBeInTheDocument()
  })

  it('selects the default (Places) tab when no ?tab= is present', () => {
    render(<ExploreTabs />)
    expect(screen.getByRole('tab', { name: 'Places' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Festivals' })).toHaveAttribute('aria-selected', 'false')
  })

  it('selects the Festivals tab from ?tab=festivals', () => {
    searchParams = new URLSearchParams('tab=festivals')
    render(<ExploreTabs />)
    expect(screen.getByRole('tab', { name: 'Festivals' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Places' })).toHaveAttribute('aria-selected', 'false')
  })

  it('falls back to the default tab for an unknown ?tab= value', () => {
    searchParams = new URLSearchParams('tab=bogus')
    render(<ExploreTabs />)
    expect(screen.getByRole('tab', { name: 'Places' })).toHaveAttribute('aria-selected', 'true')
  })

  it('writes the selected tab back to the URL when a tab is clicked', () => {
    render(<ExploreTabs />)
    fireEvent.click(screen.getByRole('tab', { name: 'Maps' }))
    expect(replace).toHaveBeenCalledWith('/explore?tab=maps')
  })
})
