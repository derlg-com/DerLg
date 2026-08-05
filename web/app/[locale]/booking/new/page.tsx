import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { BookingFormPanel } from '@/components/booking/booking-form-panel'
import { guidesApi, hotelsApi, transportApi, tripsApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'

/** Reads type/id/room/date params from the query string. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'bookings.form' })

  return {
    title: t('title'),
    // A personal checkout step has nothing for a crawler.
    robots: { index: false, follow: false },
  }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Loads the resource being booked so the form can show its real name and price
 * rather than trusting the query string, which a user can edit.
 */
async function loadResource(kind: string, id: string, locale: Locale) {
  try {
    switch (kind) {
      case 'trip': {
        const trip = await tripsApi.detail(id, { locale })
        return { name: trip.name, unitPriceUsd: trip.priceUsd, unitKey: 'perPerson' as const }
      }
      case 'hotel': {
        const hotel = await hotelsApi.detail(id, { locale })
        return {
          name: hotel.name,
          unitPriceUsd: hotel.priceFromUsd ?? 0,
          unitKey: 'perNight' as const,
        }
      }
      case 'guide': {
        const guide = await guidesApi.detail(id, { locale })
        // Guides have no name anywhere in the API, so the province is the label.
        return {
          name: guide.province ?? id,
          unitPriceUsd: guide.pricePerDayUsd,
          unitKey: 'perDay' as const,
        }
      }
      case 'transport': {
        const vehicle = await transportApi.detail(id, { locale })
        return { name: vehicle.name, unitPriceUsd: vehicle.priceUsd, unitKey: 'perDay' as const }
      }
      default:
        return null
    }
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const query = await searchParams
  const kind = first(query.type)
  const id = first(query.id)

  // Without a resource there is nothing to book; a real 404 is the honest answer.
  if (!kind || !id) notFound()

  const resource = await loadResource(kind, id, locale as Locale)
  if (!resource) notFound()

  const t = await getTranslations('bookings.form')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('title')}</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{resource.name}</p>

      <div className="mt-5">
        <BookingFormPanel
          kind={kind as 'trip' | 'hotel' | 'guide' | 'transport'}
          resourceId={id}
          name={resource.name}
          unitPriceUsd={resource.unitPriceUsd}
          unitKey={resource.unitKey}
          roomId={first(query.roomId)}
          initialCheckIn={first(query.checkIn)}
          initialCheckOut={first(query.checkOut)}
        />
      </div>
    </div>
  )
}
