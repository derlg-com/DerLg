import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Gallery } from '@/components/shared/gallery'
import { Price } from '@/components/shared/price'
import { ShareButton } from '@/components/shared/share-button'
import { Badge, Card } from '@/components/ui'
import { ApiError } from '@/lib/api/errors'
import { transportApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'
import { JsonLd, absoluteUrl, breadcrumbSchema } from '@/lib/seo'

import { VehicleAvailability } from './availability'

export const revalidate = 300

/** Renders `tuk_tuk` as "tuk tuk" without inventing a translation key. */
function readableType(value: string): string {
  return value.replace(/_/g, ' ')
}

async function loadVehicle(id: string, locale: Locale) {
  try {
    return await transportApi.detail(id, { locale })
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params
  const typed = locale as Locale
  const vehicle = await loadVehicle(id, typed)

  if (!vehicle) {
    const catalog = await getTranslations({ locale, namespace: 'catalog' })
    return { title: catalog('detail.notFoundTitle'), robots: { index: false, follow: false } }
  }

  return {
    title: vehicle.name,
    alternates: { canonical: absoluteUrl(`/transport/${vehicle.id}`, typed) },
  }
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale as Locale)
  const typed = locale as Locale

  const vehicle = await loadVehicle(id, typed)
  if (!vehicle) notFound()

  const t = await getTranslations('transportation')
  const catalog = await getTranslations('catalog')
  const shell = await getTranslations('shell')

  const gallery = [
    ...(vehicle.images ?? []),
    ...(vehicle.coverImage ? [vehicle.coverImage] : []),
  ].filter((image, index, all) => all.indexOf(image) === index)

  return (
    <>
      <JsonLd
        data={breadcrumbSchema(
          [
            { name: shell('nav.home'), path: '/' },
            { name: shell('nav.transport'), path: '/transport' },
            { name: vehicle.name, path: `/transport/${vehicle.id}` },
          ],
          typed,
        )}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
            <li>
              <Link href="/" className="hover:text-[var(--text-primary)]">
                {shell('nav.home')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/transport" className="hover:text-[var(--text-primary)]">
                {shell('nav.transport')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-[var(--text-primary)]">
              {vehicle.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0 space-y-8">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{readableType(vehicle.vehicleType)}</Badge>
                {vehicle.province ? <Badge tone="neutral">{vehicle.province}</Badge> : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">{vehicle.name}</h1>
            </header>

            <Gallery images={gallery} label={catalog('detail.gallery')} />

            <section className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">{catalog('detail.capacity')}</h2>
              <p className="text-[var(--text-secondary)]">
                {vehicle.capacity} {t('card.seats')}
              </p>
            </section>

            <VehicleAvailability id={vehicle.id} />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="space-y-4 p-5">
              <div>
                <p className="text-2xl font-semibold">
                  <Price amountUsd={vehicle.priceUsd} />
                </p>
                {/* The pricing model changes the meaning of the number entirely. */}
                {vehicle.pricingModel ? (
                  <p className="text-sm text-[var(--text-tertiary)]">
                    {readableType(vehicle.pricingModel)}
                  </p>
                ) : null}
              </div>

              <Link
                href={`/booking/new?type=transport&id=${vehicle.id}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)]"
              >
                {catalog('detail.bookNow')}
              </Link>

              <ShareButton title={vehicle.name} />
            </Card>
          </aside>
        </div>
      </div>
    </>
  )
}
