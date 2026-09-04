import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'

import type { Locale } from '@/lib/i18n/config'

/**
 * Test helpers that mount components inside the same providers the app uses.
 *
 * Rendering a component without NextIntlClientProvider throws, and without a
 * QueryClientProvider any hook using React Query throws, so tests that skip
 * these would be testing a configuration the app never runs in.
 */

const catalogues = new Map<Locale, Record<string, unknown>>()

export function messagesFor(locale: Locale): Record<string, unknown> {
  if (!catalogues.has(locale)) {
    catalogues.set(
      locale,
      JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')),
    )
  }
  return catalogues.get(locale)!
}

/** A client that fails fast instead of retrying, so error paths are testable. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: React.ReactNode,
  { locale = 'en', queryClient, ...options }: RenderWithProvidersOptions = {},
) {
  const client = queryClient ?? createTestQueryClient()

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={messagesFor(locale)}
        /*
         * A missing key is a FAILURE here, not a warning.
         *
         * next-intl's default behaviour is to log and render the key path, so a
         * deleted translation still renders something and every test keeps
         * passing while the UI shows `checkout.mockNotice` to a user. Throwing
         * turns every component test into a key-existence check — which is how a
         * real deletion of four `checkout.*` keys was caught.
         */
        onError={(error) => {
          throw error
        }}
      >
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    )
  }

  return { client, ...render(ui, { wrapper: Wrapper, ...options }) }
}
