import type { ContentItem } from '@/types/vibe-booking'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

export default function QRPaymentRenderer({ item }: Props) {
  const { data } = item.payload as { type: 'qr_payment'; data: { qrUrl: string; amount: { usd: number }; expiry: string; paymentIntentId: string } }
  return (
    <div className="p-6 flex flex-col items-center gap-4">
      <p className="font-semibold">Scan to Pay</p>
      <img src={data.qrUrl} alt="Payment QR" className="w-48 h-48 rounded-lg border" />
      <p className="text-lg font-bold">${data.amount.usd} USD</p>
      <p className="text-xs text-muted-foreground">Expires: {new Date(data.expiry).toLocaleTimeString()}</p>
    </div>
  )
}
