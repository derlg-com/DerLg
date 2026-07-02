'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api-client'

export interface ApiQueryResult<T> {
  data: T | null
  error: ApiError | null
  isLoading: boolean
  refetch: () => void
}

export interface ApiQueryOptions {
  /** Skip fetching entirely when false (or when `path` is null). Default true. */
  enabled?: boolean
  /**
   * How long (ms) a cached value is considered fresh. While fresh, mounting a
   * new consumer of the same `path` reuses the cache instead of refetching.
   * Default {@link DEFAULT_STALE_TIME}.
   */
  staleTime?: number
  /** Refetch when the browser window/tab regains focus. Default true. */
  refetchOnWindowFocus?: boolean
  /**
   * Max retry attempts for transient failures (network errors / HTTP 5xx),
   * using exponential backoff. Client errors (4xx) are never retried.
   * Default {@link DEFAULT_RETRY}.
   */
  retry?: number
}

/** Default freshness window for cached responses (30s). */
export const DEFAULT_STALE_TIME = 30_000
/** Default retry attempts for transient failures. */
export const DEFAULT_RETRY = 2
/** Base delay (ms) for exponential backoff: attempt n waits BASE * 2^n. */
const BACKOFF_BASE_MS = 300

interface CacheEntry<T = unknown> {
  data: T | null
  error: ApiError | null
  /** Epoch ms when this entry was last successfully populated. */
  updatedAt: number
}

/**
 * Module-level response cache shared across all consumers of a given `path`.
 * Keeps the layer lightweight (no provider/context) while giving us
 * configurable staleness and cross-component invalidation.
 */
const queryCache = new Map<string, CacheEntry>()

/** Listeners notified when a cache key changes (set or invalidated). */
const cacheListeners = new Map<string, Set<() => void>>()

function notify(path: string): void {
  const set = cacheListeners.get(path)
  if (!set) return
  for (const fn of set) fn()
}

function subscribe(path: string, fn: () => void): () => void {
  let set = cacheListeners.get(path)
  if (!set) {
    set = new Set()
    cacheListeners.set(path, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
    if (set && set.size === 0) cacheListeners.delete(path)
  }
}

function isFresh(entry: CacheEntry | undefined, staleTime: number): entry is CacheEntry {
  return !!entry && entry.error === null && Date.now() - entry.updatedAt < staleTime
}

/**
 * Invalidate cached query data so the next read refetches.
 *
 * - `invalidateApiQuery('/v1/bookings')` clears every entry whose path starts
 *   with the prefix (so list + filtered variants all refresh).
 * - `invalidateApiQuery()` clears the whole cache.
 *
 * Call after a successful mutation to keep dependent queries consistent
 * (e.g. after cancelling a booking, invalidate `/v1/bookings`).
 */
export function invalidateApiQuery(pathPrefix?: string): void {
  const keys = pathPrefix
    ? [...queryCache.keys()].filter((k) => k === pathPrefix || k.startsWith(pathPrefix))
    : [...queryCache.keys()]
  for (const key of keys) {
    queryCache.delete(key)
    notify(key)
  }
}

function isTransient(err: ApiError): boolean {
  // Network failures surface as HTTP_0 (no response); 5xx are server-side transient.
  return err.status === 0 || err.status >= 500
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const id = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/**
 * Minimal client-side GET hook for the DerLg API — our deliberately lightweight
 * alternative to React Query (see the project's lightweight-stack decision).
 *
 * Behaviour:
 * - Fetches `path` through the shared {@link api} client (auth + envelope handled).
 * - Tracks `data` / `error` / `isLoading`.
 * - Caches responses in a shared, module-level cache keyed by `path`, with a
 *   configurable `staleTime`; fresh cache is served without a network round-trip.
 * - Refetches when the window regains focus (`refetchOnWindowFocus`, default on).
 * - Retries transient failures (network / 5xx) with exponential backoff (`retry`).
 * - Resets to a loading state when `path` changes (render-phase adjust-on-prop-change
 *   pattern — see https://react.dev/learn/you-might-not-need-an-effect).
 * - Aborts the in-flight request when `path` changes or the component unmounts.
 * - Pass `path = null` (or `enabled: false`) to skip fetching.
 * - Use {@link invalidateApiQuery} after mutations to refresh dependent queries.
 */
export function useApiQuery<T>(path: string | null, opts?: ApiQueryOptions): ApiQueryResult<T> {
  const enabled = (opts?.enabled ?? true) && path !== null
  const staleTime = opts?.staleTime ?? DEFAULT_STALE_TIME
  const refetchOnWindowFocus = opts?.refetchOnWindowFocus ?? true
  const maxRetries = opts?.retry ?? DEFAULT_RETRY

  const cached = path ? (queryCache.get(path) as CacheEntry<T> | undefined) : undefined
  const seedFresh = isFresh(cached, staleTime)

  const [data, setData] = useState<T | null>(seedFresh ? (cached!.data as T | null) : null)
  const [error, setError] = useState<ApiError | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled && !seedFresh)
  const [trackedPath, setTrackedPath] = useState<string | null>(path)
  const abortRef = useRef<AbortController | null>(null)

  // Adjust state synchronously when the query target changes (render-phase, not an effect).
  if (path !== trackedPath) {
    setTrackedPath(path)
    const next = path ? (queryCache.get(path) as CacheEntry<T> | undefined) : undefined
    const nextFresh = isFresh(next, staleTime)
    setData(nextFresh ? (next!.data as T | null) : null)
    setError(null)
    setIsLoading(enabled && !nextFresh)
  }

  const run = useCallback(
    (force = false) => {
      if (!enabled || !path) return

      // Serve fresh cache without a network call unless explicitly forced.
      // (State is already seeded from cache at mount / on path change, so we
      // simply skip the fetch here rather than calling setState in the effect.)
      const hit = queryCache.get(path) as CacheEntry<T> | undefined
      if (!force && isFresh(hit, staleTime)) {
        return
      }

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const attempt = async (n: number): Promise<void> => {
        try {
          const result = await api.get<T>(path, { signal: ctrl.signal })
          if (ctrl.signal.aborted) return
          queryCache.set(path, { data: result, error: null, updatedAt: Date.now() })
          setData(result)
          setError(null)
          setIsLoading(false)
          notify(path)
        } catch (err: unknown) {
          if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return
          const apiErr = err as ApiError
          if (n < maxRetries && apiErr instanceof ApiError && isTransient(apiErr)) {
            await delay(BACKOFF_BASE_MS * 2 ** n, ctrl.signal).catch(() => {})
            if (ctrl.signal.aborted) return
            return attempt(n + 1)
          }
          setError(apiErr)
          setData(null)
          setIsLoading(false)
        }
      }

      void attempt(0)
    },
    [enabled, path, staleTime, maxRetries],
  )

  useEffect(() => {
    run()
    return () => abortRef.current?.abort()
  }, [run])

  // Re-render when another consumer (or a mutation) invalidates/updates this key.
  useEffect(() => {
    if (!enabled || !path) return
    return subscribe(path, () => {
      const hit = queryCache.get(path) as CacheEntry<T> | undefined
      if (hit) {
        // Another consumer refreshed the cache — adopt its value (no refetch).
        setData(hit.data as T | null)
        setError(hit.error)
        setIsLoading(false)
      } else {
        // Entry was removed by invalidateApiQuery — refetch fresh data.
        run(true)
      }
    })
  }, [enabled, path, run])

  // Refetch on window focus when the cached value has gone stale.
  useEffect(() => {
    if (!enabled || !path || !refetchOnWindowFocus || typeof window === 'undefined') return
    const onFocus = () => {
      const hit = queryCache.get(path) as CacheEntry<T> | undefined
      if (!isFresh(hit, staleTime)) run(true)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, path, refetchOnWindowFocus, staleTime, run])

  return { data, error, isLoading, refetch: () => run(true) }
}
