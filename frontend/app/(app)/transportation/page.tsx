import type { Metadata } from 'next'
import { TransportCatalog } from '@/components/transportation/TransportCatalog'

export const metadata: Metadata = {
  title: 'Transportation — DerLg',
  description: 'Book vans, buses, tuk-tuks, and private cars across Cambodia.',
}

export default function TransportationPage() {
  return <TransportCatalog />
}
