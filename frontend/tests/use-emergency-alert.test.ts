import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEmergencyAlert, isValidCoords } from '@/hooks/use-emergency-alert'

// Task 15.1 — useEmergencyAlert: GPS capture, permission handling, manual fallback
// (Requirements 10.2, 10.3, 10.6).

type SuccessCb = (pos: {
  coords: { latitude: number; longitude: number; accuracy: number }
}) => void
type ErrorCb = (err: { code: number; PERMISSION_DENIED: number; TIMEOUT: number }) => void

function installGeolocation(impl: (success: SuccessCb, error: ErrorCb) => void) {
  const getCurrentPosition = vi.fn(impl)
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
  return getCurrentPosition
}

const GEO_CODES = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }

describe('useEmergencyAlert (Task 15.1)', () => {
  beforeEach(() => {
    // reset between tests
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts idle with no coords', () => {
    const { result } = renderHook(() => useEmergencyAlert())
    expect(result.current.status).toBe('idle')
    expect(result.current.coords).toBeNull()
  })

  it('captures coordinates when permission is granted (Req 10.3)', async () => {
    installGeolocation((success) => {
      success({ coords: { latitude: 11.5564, longitude: 104.9282, accuracy: 12 } })
    })
    const { result } = renderHook(() => useEmergencyAlert())

    act(() => result.current.requestLocation())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.coords).toEqual({
      latitude: 11.5564,
      longitude: 104.9282,
      accuracyMeters: 12,
    })
  })

  it('transitions to denied on permission denial (Req 10.6)', async () => {
    installGeolocation((_success, error) => {
      error({ code: GEO_CODES.PERMISSION_DENIED, ...GEO_CODES })
    })
    const { result } = renderHook(() => useEmergencyAlert())

    act(() => result.current.requestLocation())

    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.error).toBe('permission_denied')
    expect(result.current.coords).toBeNull()
  })

  it('reports error (not denied) on timeout / unavailable', async () => {
    installGeolocation((_success, error) => {
      error({ code: GEO_CODES.TIMEOUT, ...GEO_CODES })
    })
    const { result } = renderHook(() => useEmergencyAlert())

    act(() => result.current.requestLocation())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('timeout')
  })

  it('errors when geolocation is unsupported', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
    const { result } = renderHook(() => useEmergencyAlert())

    act(() => result.current.requestLocation())

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('unsupported')
  })

  it('accepts valid manual coordinates after denial (Req 10.6)', async () => {
    installGeolocation((_success, error) => {
      error({ code: GEO_CODES.PERMISSION_DENIED, ...GEO_CODES })
    })
    const { result } = renderHook(() => useEmergencyAlert())

    act(() => result.current.requestLocation())
    await waitFor(() => expect(result.current.status).toBe('denied'))

    act(() => result.current.setManualCoords(13.3671, 103.8448))
    expect(result.current.status).toBe('ready')
    expect(result.current.coords).toEqual({
      latitude: 13.3671,
      longitude: 103.8448,
      accuracyMeters: null,
    })
  })

  it('rejects out-of-range manual coordinates', () => {
    const { result } = renderHook(() => useEmergencyAlert())
    act(() => result.current.setManualCoords(999, 999))
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBe('invalid_coords')
    expect(result.current.coords).toBeNull()
  })

  it('reset returns to idle', async () => {
    installGeolocation((success) => {
      success({ coords: { latitude: 1, longitude: 2, accuracy: 5 } })
    })
    const { result } = renderHook(() => useEmergencyAlert())
    act(() => result.current.requestLocation())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.reset())
    expect(result.current.status).toBe('idle')
    expect(result.current.coords).toBeNull()
  })
})

describe('isValidCoords', () => {
  it('accepts in-range coordinates', () => {
    expect(isValidCoords(11.5, 104.9)).toBe(true)
    expect(isValidCoords(-90, -180)).toBe(true)
    expect(isValidCoords(90, 180)).toBe(true)
  })
  it('rejects out-of-range or non-finite', () => {
    expect(isValidCoords(91, 0)).toBe(false)
    expect(isValidCoords(0, 181)).toBe(false)
    expect(isValidCoords(NaN, 0)).toBe(false)
  })
})
