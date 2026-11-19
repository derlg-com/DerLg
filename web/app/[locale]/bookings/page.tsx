import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { BookingsListView } from "@/components/booking/bookings-list-view"
import type { Locale } from "@/lib/i18n/config"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "shell" })
  return { title: t("nav.bookings"), robots: { index: false, follow: false } }
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  return <BookingsListView />
}
