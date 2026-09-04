import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { ChatView } from '@/components/chat/chat-view'
import { LoadingRegion, Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'

/** Reads ?context from the URL, so it cannot be statically prerendered. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'chat' })

  return {
    title: t('pageTitle'),
    // A live conversation has nothing durable for a crawler to index.
    robots: { index: false, follow: true },
  }
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = await getTranslations('common')

  return (
    /*
     * The transcript scrolls inside the viewport rather than the page, so the
     * composer stays reachable without chasing the document scroll on mobile.
     */
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <Suspense
        fallback={
          <LoadingRegion label={t('loading')}>
            <Skeleton className="h-64 w-full" />
          </LoadingRegion>
        }
      >
        <ChatView />
      </Suspense>
    </div>
  )
}
