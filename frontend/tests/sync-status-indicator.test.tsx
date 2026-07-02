import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator'
import { OFFLINE_QUEUE_KEY, enqueueAction } from '@/lib/offline-queue'
import { useSyncStore } from '@/stores/sync.store'

// Replay is performed via lib/offline-replay -> api-client. Mock the API so the
// indicator can flush without a real backend.
vi.mock('@/lib/api-client', () => ({
  api: {
    patch: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('SyncStatusIndicator (Req 12.9, 48.6)', () => {
  beforeEach(() => {
    window.localStorage.removeItem(OFFLINE_QUEUE_KEY)
    useSyncStore.setState({ status: 'idle', pending: 0 })
    setNavigatorOnline(true)
  })

  afterEach(() => {
    setNavigatorOnline(true)
  })

  it('renders nothing when the queue is empty and idle', () => {
    render(<SyncStatusIndicator />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a pending count for queued actions while offline', () => {
    setNavigatorOnline(false)
    enqueueAction('profile-update', { name: 'Sok' })
    enqueueAction('booking-cancel', { bookingId: 'b1' })

    render(<SyncStatusIndicator />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/2/)
  })

  it('flushes the queue and shows the synced state when back online', async () => {
    // Start offline with one queued action.
    setNavigatorOnline(false)
    enqueueAction('profile-update', { name: 'Sok' })

    render(<SyncStatusIndicator />)

    // Go online -> reconnect effect flushes the queue.
    setNavigatorOnline(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/synced/i)
    })
  })
})
