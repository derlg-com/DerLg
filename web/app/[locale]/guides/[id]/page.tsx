import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CardMedia } from '@/components/shared/card-media'
import { Price } from '@/components/shared/price'
import { ShareButton } from '@/components/shared/share-button'
import { Badge, Card } from '@/components/ui'
import { ApiError } from '@/lib/api/errors'
import { guidesApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'
import { JsonLd, absoluteUrl, breadcrumbSchema } from '@/lib/seo'

import { GuideAvailability } from './availability'

export const revalidate = 300

async function loadGuide(id: string, locale: Locale) {
  try {
    return await guidesApi.detail(id, { locale })
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
  const guide = await loadGuide(id, typed)

  const catalog = await getTranslations({ locale, namespace: 'catalog' })
  if (!guide) {
    return { title: catalog('detail.notFoundTitle'), robots: { index: false, follow: false } }
  }

  const shell = await getTranslations({ locale, namespace: 'shell' })
  // No name exists in the API, so the title is built from what does.
  const title = guide.province ? `${shell('nav.guides')} · ${guide.province}` : shell('nav.guides')

  return {
    title,
    description: guide.bio ?? undefined,
    alternates: { canonical: absoluteUrl(`/guides/${guide.id}`, typed) },
  }
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale as Locale)
  const typed = locale as Locale

  const guide = await loadGuide(id, typed)
  if (!guide) notFound()

  const t = await getTranslations('guides')
  const catalog = await getTranslations('catalog')
  const shell = await getTranslations('shell')

  const heading = guide.province ?? shell('nav.guides')

  return (
    <>
      <JsonLd
        data={breadcrumbSchema(
          [
            { name: shell('nav.home'), path: '/' },
            { name: shell('nav.guides'), path: '/guides' },
            { name: heading, path: `/guides/${guide.id}` },
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
              <Link href="/guides" className="hover:text-[var(--text-primary)]">
                {shell('nav.guides')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-[var(--text-primary)]">
              {heading}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
          <div className="space-y-4">
            <CardMedia
              src={guide.avatarUrl}
              ratio="1/1"
              sizes="(min-width: 1024px) 18rem, 100vw"
              priority
              className="rounded-lg"
            />
            <Card className="space-y-3 p-5">
              <div>
                <p className="text-2xl font-semibold">
                  <Price amountUsd={guide.pricePerDayUsd} />
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">{t('card.perDay')}</p>
              </div>
              <Link
                href={`/booking/new?type=guide&id=${guide.id}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)]"
              >
                {catalog('detail.bookNow')}
              </Link>
              <ShareButton title={heading} />
            </Card>
          </div>

          <div className="min-w-0 space-y-8">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
                {guide.isVerified ? <Badge tone="success">{t('card.verified')}</Badge> : null}
              </div>
              {guide.languages && guide.languages.length > 0 ? (
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)]">
                    {catalog('detail.languages')}:{' '}
                  </span>
                  {guide.languages
                    .map((code) => {
                      const key = `filters.languageNames.${code}`
                      return catalog.has(key as never)
                        ? catalog(key as never)
                        : code.toUpperCase()
                    })
                    .join(' · ')}
                </p>
              ) : null}
            </header>

            {guide.bio ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {catalog('detail.overview')}
                </h2>
                <p className="whitespace-pre-line text-[var(--text-secondary)]">{guide.bio}</p>
              </section>
            ) : null}

            {(() => {
              // P2: prefer the enum-backed specialties; fall back to legacy free-text.
              const specialties =
                guide.specialties && guide.specialties.length > 0
                  ? guide.specialties
                  : guide.specialities
              if (!specialties || specialties.length === 0) return null
              return (
                <section className="space-y-3">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {catalog('detail.specialities')}
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {specialties.map((item) => (
                      <li key={item}>
                        <Badge tone="neutral">{item.replace(/_/g, ' ')}</Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })()}

            {guide.provinces && guide.provinces.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {catalog('detail.provinces')}
                </h2>
                <p className="text-[var(--text-secondary)]">{guide.provinces.join(' · ')}</p>
              </section>
            ) : null}

            {guide.packages && guide.packages.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {catalog('detail.packages')}
                </h2>
                <ul className="flex flex-col gap-2">
                  {guide.packages.map((pkg) => (
                    <li key={pkg.id ?? pkg.name ?? 'pkg'}>
                      <Link
                        href={`/trips/${pkg.id}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                            {pkg.name ?? catalog('detail.package')}
                          </span>
                          <span className="block text-xs text-[var(--text-tertiary)]">
                            {[
                              typeof pkg.durationDays === 'number'
                                ? catalog('detail.packageDays', { count: pkg.durationDays })
                                : null,
                              typeof pkg.priceUsd === 'number'
                                ? `$${pkg.priceUsd}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <GuideAvailability id={guide.id} />
          </div>
        </div>
      </div>
    </>
  )
}
