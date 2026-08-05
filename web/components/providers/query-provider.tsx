'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

import { ApiError } from '@/lib/api/errors'

/**
 * Creates a QueryClient with retry behaviour that matches the backend.
 *
 * Client errors (400/401/403/404, validation) are never retried: retrying a 404
 * or a rejected DTO cannot succeed and only delays the error state the user
 * needs to see. Transport failures and 5xx are retried with backoff.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          if (error instanceof ApiError && !error.isRetryable) return false
          return failureCount < 2
        },
        retryDelay(attempt) {
          return Math.min(1000 * 2 ** attempt, 8000)
        },
      },
      mutations: {
        // Mutations are not retried by default: a booking POST that may have
        // succeeded must not be silently repeated. Callers that are safe to
        // retry pass an Idempotency-Key and opt in explicitly.
        retry: false,
      },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState keeps one client per browser session while avoiding a module-level
  // singleton, which would leak cached data between users during SSR.
  const [client] = React.useState(createQueryClient)

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
