import type { ContentItem } from '@/types/vibe-booking'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

export default function BookingConfirmedRenderer({ item }: Props) {
  const { data } = item.payload as { type: 'booking_confirmed'; data: { bookingRef: string; tripName: string; travelDate: string } }
  return (
    <div className="p-6 text-center space-y-2">
      <div className="text-4xl">✅</div>
      <p className="font-bold text-lg">Booking Confirmed!</p>
      <p className="text-sm text-muted-foreground">{data.tripName}</p>
      <p className="font-mono text-sm bg-muted rounded px-3 py-1 inline-block">{data.bookingRef}</p>
      <p className="text-xs text-muted-foreground">{data.travelDate}</p>
    </div>
  )
}
