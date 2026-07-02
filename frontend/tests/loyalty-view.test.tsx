import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api-client'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { UserProfile, Paginated, LoyaltyLedgerEntry } from '@/types/api'

// Task 16.5 — Loyalty points view: balance, tier progress, redemption,
// paginated history with graceful degradation when the history endpoint
// (assumed contract) is unavailable.

const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

// BookingShell gates on auth; treat the user as authenticated and rehydrated.
vi.mock('@/hooks/use-auth', () => ({
  useRequireAuth: () => ({ isAuthenticated: true, rehydrated: true }),
}))

import { LoyaltyView } from '@/components/profile/LoyaltyView'

function loading<T>(): ApiQueryResult<T> {
  return { data: null, error: null, isLoading: true, refetch: vi.fn() }
}
function ok<T>(data: T): ApiQueryResult<T> {
  return { data, error: null, isLoading: false, refetch: vi.fn() }
}
function fail<T>(status = 404): ApiQueryResult<T> {
  return {
    data: null,
    error: new ApiError({ code: `HTTP_${status}`, message: 'nope', status }),
    isLoading: false,
    refetch: vi.fn(),
  }
}

function user(points: number): UserProfile {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'Trav',
    phone: null,
    avatarUrl: null,
    role: 'user',
    loyaltyPoints: points,
    isStudent: false,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function ledger(items: LoyaltyLedgerEntry[]): Paginated<LoyaltyLedgerEntry> {
  return { items, total: items.length, page: 1, limit: 10, totalPages: 1 }
}

/** Route the two queries by path: balance (/v1/users/me) and history. */
function wire(opts: { balance: ApiQueryResult<unknown>; history: ApiQueryResult<unknown> }) {
  useApiQuery.mockImplementation((path: string | null): ApiQueryResult<unknown> => {
    if (path && path.includes('/loyalty/history')) return opts.history
    return opts.balance
  })
}

beforeEach(() => {
  useApiQuery.mockReset()
})

describe('LoyaltyView', () => {
  it('shows a skeleton while the balance is loading', () => {
    wire({ balance: loading(), history: loading() })
    const { container } = render(<LoyaltyView />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('shows an error state when the balance fails to load', () => {
    wire({ balance: fail(500), history: ok(ledger([])) })
    render(<LoyaltyView />)
    expect(screen.getByText("Couldn't load your points")).toBeInTheDocument()
  })

  it('renders the balance, tier progress, and redemption when data loads', () => {
    wire({ balance: ok(user(1_500)), history: ok(ledger([])) })
    render(<LoyaltyView />)

    // Balance (toLocaleString → "1,500")
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('Available points')).toBeInTheDocument()
    // 1500 points → silver tier, next is gold
    expect(screen.getByText('Silver')).toBeInTheDocument()
    expect(screen.getByText('Gold')).toBeInTheDocument()
    // Redemption section
    expect(screen.getByText('Redeem points')).toBeInTheDocument()
  })

  it('shows an empty history state when there is no activity', () => {
    wire({ balance: ok(user(100)), history: ok(ledger([])) })
    render(<LoyaltyView />)
    expect(screen.getByText('No points activity yet')).toBeInTheDocument()
  })

  it('degrades gracefully when the history endpoint is unavailable', () => {
    wire({ balance: ok(user(100)), history: fail(404) })
    render(<LoyaltyView />)
    // Balance still renders…
    expect(screen.getByText('100')).toBeInTheDocument()
    // …and history shows the unavailable state, not a crash.
    expect(screen.getByText('History unavailable')).toBeInTheDocument()
  })

  it('renders history entries with signed point deltas', () => {
    wire({
      balance: ok(user(300)),
      history: ok(
        ledger([
          {
            id: 'e1',
            description: 'Booking #1234',
            points: 200,
            bookingId: 'bk-1',
            createdAt: '2026-02-01T00:00:00Z',
          },
          {
            id: 'e2',
            description: 'Redeemed for discount',
            points: -100,
            createdAt: '2026-03-01T00:00:00Z',
          },
        ]),
      ),
    })
    render(<LoyaltyView />)
    expect(screen.getByText('Booking #1234')).toBeInTheDocument()
    expect(screen.getByText('+200')).toBeInTheDocument()
    expect(screen.getByText('Redeemed for discount')).toBeInTheDocument()
    expect(screen.getByText('-100')).toBeInTheDocument()
  })
})
