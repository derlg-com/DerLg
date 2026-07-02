'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Legal/compliance consent state (Section 32 — cookie consent + age gate).
 *
 * Persisted to localStorage via zustand `persist` (mirrors the convention used
 * by {@link import('./preferences.store')}). Two independent decisions are
 * tracked:
 *
 * - `cookieConsent` — `null` until the user makes a choice; `'accepted'` or
 *   `'rejected'` afterwards. The cookie banner shows only while this is `null`
 *   (Requirement 50.5). Analytics (`lib/analytics.ts` `trackEvent`) is a no-op
 *   unless this is `'accepted'` (Requirement 23.7 / 50.4) — non-essential
 *   cookies/analytics stay disabled when rejected.
 * - `ageConfirmed` — `true` once the user confirms they are 18+ (Requirement
 *   50.9). The age-verification notice shows only while this is `false`.
 *
 * Both default to the "no decision yet" value so the gates render on first
 * visit and disappear once a choice is persisted.
 */

export type CookieConsent = 'accepted' | 'rejected'

interface ConsentState {
  /** `null` = undecided; otherwise the user's persisted cookie choice. */
  cookieConsent: CookieConsent | null
  /** Whether the user has confirmed they are 18 or older. */
  ageConfirmed: boolean
  acceptCookies: () => void
  rejectCookies: () => void
  confirmAge: () => void
  /** Reset all consent decisions (e.g. from a privacy settings screen). */
  resetConsent: () => void
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      cookieConsent: null,
      ageConfirmed: false,
      acceptCookies: () => set({ cookieConsent: 'accepted' }),
      rejectCookies: () => set({ cookieConsent: 'rejected' }),
      confirmAge: () => set({ ageConfirmed: true }),
      resetConsent: () => set({ cookieConsent: null, ageConfirmed: false }),
    }),
    { name: 'derlg:consent' },
  ),
)

/**
 * Non-reactive read of whether analytics/non-essential cookies are permitted.
 * Safe to call from anywhere (including `lib/analytics.ts`, which must stay
 * framework-free). Returns `false` until the user explicitly accepts.
 */
export function hasAnalyticsConsent(): boolean {
  return useConsentStore.getState().cookieConsent === 'accepted'
}
