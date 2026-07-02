'use client'

import { useCallback, useRef, useState } from 'react'
import type { GeoCoordinates } from '@/types/domain'

/**
 * Lifecycle of the geolocation capture used by the Emergency Alert flow
 * (Requirements 10.2, 10.3, 10.6):
 *
 * - `idle`     — nothing requested yet.
 * - `locating` — a browser geolocation request is in flight.
 * - `ready`    — coordinates captured (via GPS or manual entry).
 * - `denied`   — the user denied permission; fall back to manual entry.
 * - `error`    — geolocation unavailable/failed for a non-permission reason.
 */
export type EmergencyLocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'error'

export interface UseEmergencyAlertReturn {
  /** Captured coordinates, or null until a fix (GPS or manual) is available. */
  coords: GeoCoordinates | null
  status: EmergencyLocationStatus
  /** Human-readable error reason key for non-fatal display, or null. */
  error: string | null
  /** Trigger a browser geolocation request (Req 10.2/10.3). */
  requestLocation: () => void
  /** Manual fallback when permission is denied (Req 10.6). */
  setManualCoords: (latitude: number, longitude: number) => void
  /** Reset back to the idle state (e.g. when the modal closes). */
  reset: () => void
}

/** Default geolocation options: high accuracy, 10s timeout. */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
}

/** Range-validate a latitude/longitude pair. */
export function isValidCoords(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

/**
 * Captures the user's location for an emergency alert.
 *
 * Requests the browser Geolocation API on demand and exposes the captured
 * coordinates plus a status machine. On permission denial it transitions to
 * `denied` so the UI can present a manual lat/lng entry fallback (Req 10.6);
 * `setManualCoords` then provides the coordinates the alert is sent with.
 *
 * This hook is intentionally side-effect-light: it does not auto-request on
 * mount (the alert flow requests location only after the user opts in).
 */
export function useEmergencyAlert(): UseEmergencyAlertReturn {
  const [coords, setCoords] = useState<GeoCoordinates | null>(null)
  const [status, setStatus] = useState<EmergencyLocationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  // Guards against a late geolocation callback updating state after reset.
  const requestIdRef = useRef(0)

  const requestLocation = useCallback(() => {
    const requestId = ++requestIdRef.current
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error')
      setError('unsupported')
      return
    }

    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== requestIdRef.current) return
        const { latitude, longitude, accuracy } = position.coords
        setCoords({
          latitude,
          longitude,
          accuracyMeters: Number.isFinite(accuracy) ? accuracy : null,
        })
        setStatus('ready')
      },
      (err) => {
        if (requestId !== requestIdRef.current) return
        // PERMISSION_DENIED === 1 → offer the manual-entry fallback (Req 10.6).
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied')
          setError('permission_denied')
        } else {
          setStatus('error')
          setError(err.code === err.TIMEOUT ? 'timeout' : 'position_unavailable')
        }
      },
      GEO_OPTIONS,
    )
  }, [])

  const setManualCoords = useCallback((latitude: number, longitude: number) => {
    // Ignore any in-flight GPS callback once the user commits manual coords.
    requestIdRef.current++
    if (!isValidCoords(latitude, longitude)) {
      setError('invalid_coords')
      return
    }
    setCoords({ latitude, longitude, accuracyMeters: null })
    setStatus('ready')
    setError(null)
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++
    setCoords(null)
    setStatus('idle')
    setError(null)
  }, [])

  return { coords, status, error, requestLocation, setManualCoords, reset }
}
