import type { ContentItem } from '@/stores/vibe-booking.store'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUCCEEDED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}
export default function PaymentStatusRenderer({ item, onAction }: Props) {
  const { status, paymentIntentId, amountUsd } = item.data as { status: string; paymentIntentId: string; amountUsd: number }
  return (
    <div className="p-4 flex flex-col items-center gap-3 text-center">
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
      <p className="text-lg font-bold">${amountUsd} USD</p>
      {status === 'FAILED' && (
        <button onClick={() => onAction('retry_payment', paymentIntentId, { paymentIntentId })} className="text-sm bg-primary text-primary-foreground rounded-md px-4 py-2">
          Retry Payment
        </button>
      )}
    </div>
  )
}
