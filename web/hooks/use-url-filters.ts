'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

/**
 * Keeps filter state in the URL.
 *
 * Filters belong in the query string, not component state: a filtered list is
 * something users bookmark, share and reach with the back button. Reading from
 * `useSearchParams` also means the server sees the same filters on first load.
 *
 * This uses the plain Next router rather than the locale-aware one from
 * `lib/i18n/navigation`. The typed router keys navigation on the pathname, so
 * pushing the same path with a different (or removed) query string is treated as
 * a no-op — which silently broke "clear filters". `usePathname` here already
 * includes the locale prefix, so links stay correct.
 *
 * Empty values are removed rather than serialised, both to keep URLs clean and
 * because the backend rejects unknown or empty query parameters.
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(defaults: T) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = React.useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = searchParams.get(String(key))
      if (value !== null && value !== '') {
        result[key] = value as T[keyof T]
      }
    }
    return result
  }, [searchParams, defaults])

  const setFilters = React.useCallback(
    (updates: Partial<Record<keyof T, string | undefined>>) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, value)
      }

      // Any filter change resets pagination: page 4 of the old result set is
      // meaningless against the new one.
      if (!('page' in updates)) next.delete('page')

      const query = next.toString()
      // `scroll: false` keeps the user's place in the list while results update.
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const clearFilters = React.useCallback(() => {
    router.push(pathname, { scroll: false })
  }, [router, pathname])

  const activeCount = React.useMemo(() => {
    return (Object.keys(defaults) as string[]).filter((key) => {
      if (key === 'page') return false
      const value = searchParams.get(key)
      return value !== null && value !== ''
    }).length
  }, [searchParams, defaults])

  return { filters, setFilters, clearFilters, activeCount }
}
