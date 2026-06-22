import type { Metadata } from 'next'
import { GuidesCatalog } from '@/components/guides/GuidesCatalog'

export const metadata: Metadata = {
  title: 'Guides — DerLg',
  description: 'Find verified local tour guides across Cambodia.',
}

export default function GuidesPage() {
  return <GuidesCatalog />
}
