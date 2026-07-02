import type { Metadata } from 'next'
import { FestivalCalendarView } from '@/components/festivals/FestivalCalendarView'
import { absoluteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Festivals — DerLg',
  description: 'Browse Cambodia festivals by month or list, color-coded by type.',
  keywords: ['Cambodia festivals', 'Khmer New Year', 'Water Festival', 'Pchum Ben'],
  alternates: { canonical: absoluteUrl('/festivals') },
}

export default function FestivalsPage() {
  return <FestivalCalendarView />
}
