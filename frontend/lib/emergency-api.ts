import { api } from './api-client'
import type { EmergencyAlert, EmergencyAlertRequest, EmergencyContact } from '@/types/domain'

/**
 * Emergency Alert API contract (Requirement 10).
 *
 * BACKEND-CONTRACT ASSUMPTION
 * ---------------------------
 * At the time of writing the backend has NO emergency-alerts controller. This
 * module defines the frontend contract the backend is expected to implement:
 *
 *   POST /v1/emergency-alerts
 *     body  → {@link EmergencyAlertRequest} (alertType, latitude, longitude,
 *             accuracyMeters?, bookingId?, notes?)
 *     data  → {@link EmergencyAlert}
 *
 *   GET  /v1/emergency-alerts/contacts
 *     data  → {@link EmergencyContact}[]  (local responder phone numbers)
 *
 * Because the endpoint may not exist yet, the alert flow MUST degrade
 * gracefully: a failed POST surfaces an error but the UI still shows the static
 * Cambodia emergency numbers below so a traveler always has someone to call.
 */

/** Send an emergency alert with the captured GPS coordinates and booking id. */
export function sendEmergencyAlert(request: EmergencyAlertRequest): Promise<EmergencyAlert> {
  // Idempotency-Key guards against the countdown firing a duplicate alert if the
  // network retries (the client retries transient failures with backoff).
  return api.post<EmergencyAlert>('/v1/emergency-alerts', request, { idempotencyKey: true })
}

/**
 * Best-effort fetch of locale-specific responder contacts. Returns `null` (never
 * throws) so callers can fall back to {@link CAMBODIA_EMERGENCY_CONTACTS} when
 * the endpoint is unavailable.
 */
export async function fetchEmergencyContacts(): Promise<EmergencyContact[] | null> {
  try {
    return await api.get<EmergencyContact[]>('/v1/emergency-alerts/contacts')
  } catch {
    return null
  }
}

/**
 * Static fallback list of Cambodia national emergency numbers. Always available
 * even with no live backend (Req 10.5 — show emergency contact numbers after an
 * alert, and the safety net if the POST/contacts request fails).
 *
 * `serviceName` is an i18n key under `emergency.contacts.*`; the UI translates it
 * via the custom i18n layer (falls back to English) so the numbers are routed
 * through i18n where possible while the dialable phone stays constant.
 */
export const CAMBODIA_EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'kh-police',
    province: 'National',
    serviceName: 'police',
    phone: '117',
    address: null,
  },
  {
    id: 'kh-fire',
    province: 'National',
    serviceName: 'fire',
    phone: '118',
    address: null,
  },
  {
    id: 'kh-ambulance',
    province: 'National',
    serviceName: 'ambulance',
    phone: '119',
    address: null,
  },
  {
    id: 'kh-tourist-police',
    province: 'National',
    serviceName: 'touristPolice',
    phone: '012 942 484',
    address: null,
  },
]
