'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api-client'

export interface ApiQueryResult<T> {
  data: T | null
  error: ApiError | null
  isLoading: boolean
  refetch: () => void
}

/**
 * Minimal client-side GET hook for the DerLg API.
 *
 * - Fetches `path` through the shared {@link api} client (auth + envelope handled).
 * - Tracks `data` / `error` / `isLoading`.
 * - Resets to a loading state when `path` changes (render-phase adjust-on-prop-change
 *   pattern — see https://react.dev/learn/you-might-not-need-an-effect).
 * - Aborts the in-flight request when `path` changes or the component unmounts.
 * - Pass `path = null` (or `enabled: false`) to skip fetching.
 *
 * Deliberately tiny — we are not adding React Query per the project's
 * lightweight-stack decision.
 */
export function useApiQuery<T>(
  path: string | null,
  opts?: { enabled?: boolean },
): ApiQueryResult<T> {
  const enabled = (opts?.enabled ?? true) && path !== null
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [trackedPath, setTrackedPath] = useState<string | null>(path)
  const abortRef = useRef<AbortController | null>(null)

  // Adjust state synchronously when the query target changes (render-phase, not an effect).
  if (path !== trackedPath) {
    setTrackedPath(path)
    setData(null)
    setError(null)
    setIsLoading(enabled)
  }

  const run = useCallback(() => {
    if (!enabled || !path) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    api
      .get<T>(path, { signal: ctrl.signal })
      .then((result) => {
        if (ctrl.signal.aborted) return
        setData(result)
        setError(null)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return
        setError(err as ApiError)
        setData(null)
        setIsLoading(false)
      })
  }, [enabled, path])

  useEffect(() => {
    run()
    return () => abortRef.current?.abort()
  }, [run])

  return { data, error, isLoading, refetch: run }
}
