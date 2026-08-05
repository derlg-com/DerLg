import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { Hero } from '@/components/discovery/hero'
import { FestivalStrip } from '@/components/discovery/festival-strip'
import { GuidesShelf, HotelsShelf, TripsShelf } from '@/components/discovery/shelves'
import { ChatCallout } from '@/components/discovery/chat-callout'
import { Card, CardContent, Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'
import { JsonLd, absoluteUrl, organisationSchema, websiteSchema } from '@/lib/seo'

/** Home content is catalogue-driven; refresh it periodically rather than per request. */
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const brand = await getTranslations({ locale, namespace: 'brand' })
  const typed = locale as Locale

  return {
    title: brand('headline'),
    description: brand('subline'),
    alternates: {
      canonical: absoluteUrl('/', typed),
      languages: {
        en: absoluteUrl('/', 'en'),
        zh: absoluteUrl('/', 'zh'),
        km: absoluteUrl('/', 'km'),
      },
    },
    openGraph: {
      title: brand('headline'),
      description: brand('subline'),
      url: absoluteUrl('/', typed),
      siteName: 'DerLg',
      type: 'website',
    },
  }
}

/** Placeholder occupying a shelf's space while its data loads. */
function ShelfSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index}>
            <Card className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <CardContent className="space-y-2 pt-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)
  const typed = locale as Locale

  return (
    <>
      <JsonLd data={organisationSchema(typed)} />
      <JsonLd data={websiteSchema(typed)} />

      <Hero />

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6">
        {/* Each shelf streams independently, so a slow query cannot block the rest. */}
        <Suspense fallback={<ShelfSkeleton />}>
          <TripsShelf locale={typed} />
        </Suspense>

        <ChatCallout />

        <Suspense fallback={<ShelfSkeleton />}>
          <HotelsShelf locale={typed} />
        </Suspense>

        {/* Festivals arrive through the BFF, so this strip is client-rendered. */}
        <FestivalStrip />

        <Suspense fallback={<ShelfSkeleton />}>
          <GuidesShelf locale={typed} />
        </Suspense>
      </div>
    </>
  )
}
