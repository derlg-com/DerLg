import type { Metadata } from 'next'
import { TransportCatalog } from '@/components/transportation/TransportCatalog'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Transportation — DerLg',
  description: 'Book vans, buses, tuk-tuks, and private cars across Cambodia.',
  keywords: ['Cambodia transport', 'airport transfer', 'private car', 'bus', 'tuk-tuk'],
  alternates: { canonical: absoluteUrl('/transportation') },
}

export default function TransportationPage() {
  return <TransportCatalog />
}
