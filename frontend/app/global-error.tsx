'use client'

import { useEffect } from 'react'

/**
 * Global error boundary (Requirements 16.8, 16.9 / Property 39, 40).
 *
 * This is the last line of defense: unlike `app/error.tsx`, it catches errors
 * thrown by the *root layout itself*. Because it replaces the root layout, it
 * MUST render its own `<html>` and `<body>`, and it cannot depend on app
 * providers (i18n store, fonts, Toaster) — those may be exactly what failed.
 *
 * Strings are intentionally hardcoded English here: the i18n store lives in a
 * provider that is unavailable in this degraded state. Inline styles are used
 * for the same reason — the global stylesheet may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Hook point for Sentry in production (Requirement 16.9).
    if (process.env.NODE_ENV !== 'production') {
      console.error('Fatal application error (root layout):', error)
    }
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          color: '#0f172a',
          background: '#f5f8f6',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ color: '#475569', maxWidth: '28rem', margin: 0 }}>
          An unexpected error occurred while loading the app. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            cursor: 'pointer',
            height: '2.75rem',
            padding: '0 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#ffffff',
            background: '#1d7a45',
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  )
}
