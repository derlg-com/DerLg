'use client'

import { useLocale } from 'next-intl'
import * as React from 'react'

import { authApi } from '@/lib/api/auth'
import { clearSession, getSession, setSession } from '@/lib/auth/session'
import type { Locale } from '@/lib/i18n/config'

/** Access tokens last 15 minutes; refresh a little early to avoid a gap. */
const REFRESH_INTERVAL_MS = 13 * 60 * 1000

/**
 * Restores the session on load and keeps the access token fresh.
 *
 * The token is deliberately not persisted, so a reload starts as a guest and this
 * component exchanges the httpOnly refresh cookie for a new token. A failure is
 * the normal path for a genuine guest, so it clears quietly rather than surfacing
 * an error.
 *
 * Writes go to the external session store rather than React state, which keeps
 * this free of the setState-in-effect cascade.
 */
export function SessionBootstrap() {
  const locale = useLocale() as Locale

  React.useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const result = await authApi.refresh()
        if (cancelled) return

        // `refresh` returns only a token, so fetch the profile separately.
        const user = await authApi.me(result.accessToken, locale).catch(() => null)
        if (cancelled) return

        setSession({ token: result.accessToken, user, ready: true })
      } catch {
        if (!cancelled) clearSession()
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [locale])

  // Rotate the token while the tab is open.
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!getSession().token) return

      void authApi
        .refresh()
        .then((result) => setSession({ token: result.accessToken }))
        .catch(() => clearSession())
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])

  return null
}
