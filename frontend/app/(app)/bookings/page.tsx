import type { Metadata } from 'next'
import { MyTripsView } from '@/components/bookings/MyTripsView'

export const metadata: Metadata = {
  title: 'My Trips — DerLg',
}

export default function BookingsPage() {
  return <MyTripsView />
}
