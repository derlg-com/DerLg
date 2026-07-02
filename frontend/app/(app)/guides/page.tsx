import type { Metadata } from 'next'
import { GuidesCatalog } from '@/components/guides/GuidesCatalog'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Guides — DerLg',
  description: 'Find verified local tour guides across Cambodia.',
  keywords: ['Cambodia tour guides', 'local guides', 'private guides', 'Angkor guides'],
  alternates: { canonical: absoluteUrl('/guides') },
}

export default function GuidesPage() {
  return <GuidesCatalog />
}
