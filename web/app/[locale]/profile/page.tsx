import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ProfileView } from '@/components/auth/profile-view'
import type { Locale } from '@/lib/i18n/config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const shell = await getTranslations({ locale, namespace: 'shell' })
  // Personal pages are never indexed.
  return { title: shell('nav.profile'), robots: { index: false, follow: false } }
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  return <ProfileView />
}
