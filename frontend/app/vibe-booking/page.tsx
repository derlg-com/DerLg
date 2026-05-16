import SplitScreenLayout from '@/components/vibe-booking/SplitScreenLayout'

export const metadata = { title: 'Vibe Booking — DerLg' }

export default function VibeBookingPage() {
  // userId and language will come from auth session in production
  return (
    <SplitScreenLayout
      userId="guest"
      language="EN"
    />
  )
}
