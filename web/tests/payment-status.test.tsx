import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messagesFor } from './helpers/render'

/**
 * The payment-status poll.
 *
 * Tested against a stubbed `fetch` rather than a mocked hook, because the parts
 * that can silently break are exactly the ones a mock hides: whether the request
 * hits the first-class `/v1/payments/status` endpoint carrying the bearer token it
 * requires, and whether the loop gives up on a rejection instead of retrying it
 * sixty times.
 */

let token: string | null = 'tok-abc'

vi.mock('@/hooks/use-auth', () => ({
  useAccessToken: () => token,
  useSession: () => ({ user: token ? { id: 'u1' } : null, ready: true }),
}))

const { usePaymentStatus, toPaymentState } = await import('@/hooks/use-payment-status')

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return (
    <NextIntlClientProvider locale="en" messages={messagesFor('en')}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  )
}

const fetchMock = vi.fn()

beforeEach(() => {
  token = 'tok-abc'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // Pin the backend origin so the URL assertions are deterministic.
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3003')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** A real Response so the API client's `response.text()` unwrapping works. */
function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

describe('toPaymentState', () => {
  it('maps the backend lowercase vocabulary onto the block vocabulary', () => {
    expect(toPaymentState('succeeded')).toBe('SUCCEEDED')
    expect(toPaymentState('paid')).toBe('SUCCEEDED')
    expect(toPaymentState('failed')).toBe('FAILED')
    expect(toPaymentState('canceled')).toBe('CANCELLED')
    expect(toPaymentState('expired')).toBe('CANCELLED')
    expect(toPaymentState('pending')).toBe('PENDING')
  })

  it('treats anything unrecognised as PENDING, never as success', () => {
    // Guessing "succeeded" from an unknown value is the one unacceptable failure.
    expect(toPaymentState('weird-new-status')).toBe('PENDING')
    expect(toPaymentState(null)).toBe('PENDING')
    expect(toPaymentState(undefined)).toBe('PENDING')
  })
})

describe('usePaymentStatus', () => {
  it('calls the first-class endpoint with the bearer token it requires', async () => {
    fetchMock.mockReturnValue(
      respond({ success: true, data: { booking_id: 'b1', status: 'pending' } }),
    )

    const { result } = renderHook(() => usePaymentStatus({ bookingId: 'b1' }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/payments/status')
    expect(url).toContain('bookingId=b1')
    // Without this header the endpoint 401s and the whole feature is dead.
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc')
  })

  it('does not poll at all for a guest, rather than hammering a 401', async () => {
    token = null
    fetchMock.mockReturnValue(respond({ success: true, data: {} }))

    renderHook(() => usePaymentStatus({ bookingId: 'b1' }), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a settled payment and marks it terminal', async () => {
    fetchMock.mockReturnValue(
      respond({
        success: true,
        data: {
          booking_id: 'b1',
          booking_status: 'confirmed',
          payment_intent_id: 'pi_1',
          status: 'succeeded',
          amount_usd: 240,
          method: 'stripe',
          qr_expires_at: null,
        },
      }),
    )

    const { result } = renderHook(() => usePaymentStatus({ bookingId: 'b1' }), { wrapper })

    await waitFor(() => expect(result.current.data?.state).toBe('SUCCEEDED'))
    expect(result.current.data?.settled).toBe(true)
    expect(result.current.data?.amountUsd).toBe(240)
    expect(result.current.data?.method).toBe('stripe')
  })

  it('surfaces the ABA QR expiry so the panel can count down', async () => {
    const qrExpiresAt = '2030-01-01T00:00:00.000Z'
    fetchMock.mockReturnValue(
      respond({
        success: true,
        data: {
          booking_id: 'b1',
          booking_status: 'pending_payment',
          status: 'pending',
          method: 'aba',
          qr_expires_at: qrExpiresAt,
        },
      }),
    )

    const { result } = renderHook(() => usePaymentStatus({ bookingId: 'b1' }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.qrExpiresAt).toBe(qrExpiresAt)
    expect(result.current.data?.settled).toBe(false)
  })

  it('leaves a pending payment unsettled so the loop keeps watching', async () => {
    fetchMock.mockReturnValue(
      respond({ success: true, data: { booking_id: 'b1', status: 'pending' } }),
    )

    const { result } = renderHook(() => usePaymentStatus({ bookingId: 'b1' }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.state).toBe('PENDING')
    expect(result.current.data?.settled).toBe(false)
  })

  it('stops rather than retrying a rejection', async () => {
    fetchMock.mockReturnValue(
      respond({ success: false, error: { code: 'UNAUTHORIZED', message: 'nope' } }, 401),
    )

    const { result } = renderHook(() => usePaymentStatus({ bookingId: 'b1' }), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const callsAfterError = fetchMock.mock.calls.length

    // A 401 will not fix itself; retrying would fire ~60 doomed requests.
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(fetchMock.mock.calls.length).toBe(callsAfterError)
  })

  it('is inert without a booking id', async () => {
    fetchMock.mockReturnValue(respond({ success: true, data: {} }))

    renderHook(() => usePaymentStatus({ bookingId: undefined }), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is inert when explicitly disabled', async () => {
    fetchMock.mockReturnValue(respond({ success: true, data: {} }))

    renderHook(() => usePaymentStatus({ bookingId: 'b1', enabled: false }), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
