import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CheckoutView } from '@/components/booking/checkout-view'
import type { Locale } from '@/lib/i18n/config'

/** A private, per-user record that changes as payment progresses. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'checkout' })

  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale as Locale)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <CheckoutView bookingId={id} />
    </div>
  )
}
