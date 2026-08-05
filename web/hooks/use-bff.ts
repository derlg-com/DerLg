'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { z } from 'zod'

import { queryKeys } from '@/lib/api/query-keys'
import { ApiError, NetworkError } from '@/lib/api/errors'
import { toAcceptLanguage, type Locale } from '@/lib/i18n/config'

/**
 * Client access to the BFF-proxied `ai-tools` endpoints.
 *
 * These never touch `/v1` directly: the underlying endpoints require a service
 * key that must stay on the server, so requests go to our own `/api/ai/*` routes.
 */

/** Festivals use snake_case dates, unlike every other endpoint. */
export const FestivalSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  province: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  images: z.array(z.string()).nullish(),
})
export type Festival = z.infer<typeof FestivalSchema>

export const WeatherSchema = z.looseObject({
  location: z.string().nullish(),
  date: z.string().nullish(),
  condition: z.string().nullish(),
  temp_high_c: z.number().nullish(),
  temp_low_c: z.number().nullish(),
})
export type Weather = z.infer<typeof WeatherSchema>

export const EmergencyContactsSchema = z.looseObject({
  location: z.string().nullish(),
  police: z.string().nullish(),
  ambulance: z.string().nullish(),
  fire: z.string().nullish(),
  tourist_police: z.string().nullish(),
})

export const LoyaltySchema = z.looseObject({
  points: z.number().nullish(),
  balance: z.number().nullish(),
  tier: z.string().nullish(),
})

interface BffOptions {
  locale: Locale
  token?: string | null
  signal?: AbortSignal
  query?: Record<string, string | number | undefined>
  body?: unknown
  method?: 'GET' | 'POST'
}

/** Calls a BFF route and unwraps the envelope, throwing typed errors. */
async function callBff<T>(route: string, options: BffOptions): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }

  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': toAcceptLanguage(options.locale),
  }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (method === 'POST') headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`/api/ai/${route}${search.size ? `?${search}` : ''}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : 'Request failed')
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: T
    error?: { code?: string; message?: string }
  } | null

  if (!response.ok || !payload?.success) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'INTERNAL_ERROR',
      messages: [payload?.error?.message ?? 'Request failed'],
    })
  }

  return payload.data as T
}

export function useFestivals() {
  const locale = useLocale() as Locale

  return useQuery({
    queryKey: queryKeys.bff.festivals(locale),
    queryFn: async ({ signal }) => {
      const data = await callBff<unknown>('festivals', { locale, signal })
      // The endpoint returns a bare array.
      return z.array(FestivalSchema).parse(data)
    },
    staleTime: 10 * 60_000,
  })
}

export function useWeather(location: string, date: string) {
  const locale = useLocale() as Locale

  return useQuery({
    queryKey: queryKeys.bff.weather(locale, location, date),
    queryFn: async ({ signal }) => {
      const data = await callBff<unknown>('weather', { locale, signal, query: { location, date } })
      return WeatherSchema.parse(data)
    },
    enabled: Boolean(location && date),
  })
}

export function useEmergencyContacts(location: string) {
  const locale = useLocale() as Locale

  return useQuery({
    queryKey: queryKeys.bff.emergencyContacts(locale, location),
    queryFn: async ({ signal }) => {
      const data = await callBff<unknown>('emergency-contacts', {
        locale,
        signal,
        query: { location },
      })
      return EmergencyContactsSchema.parse(data)
    },
    enabled: Boolean(location),
    staleTime: 60 * 60_000,
  })
}

/**
 * Loyalty balance. Requires a token: the BFF derives the user from it and
 * refuses the request otherwise, so this stays disabled for guests.
 */
export function useLoyalty(token: string | null) {
  const locale = useLocale() as Locale

  return useQuery({
    queryKey: queryKeys.bff.loyalty(),
    queryFn: async ({ signal }) => {
      const data = await callBff<unknown>('loyalty', { locale, token, signal })
      return LoyaltySchema.parse(data)
    },
    enabled: Boolean(token),
  })
}

/** Raises an SOS. Authenticated only; the user id comes from the token. */
export async function sendSos(
  input: { location: string; message: string },
  options: { locale: Locale; token: string },
): Promise<unknown> {
  return callBff<unknown>('sos', {
    locale: options.locale,
    token: options.token,
    method: 'POST',
    body: input,
  })
}

export { callBff }
