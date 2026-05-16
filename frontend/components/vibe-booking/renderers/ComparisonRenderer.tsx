import type { ContentItem } from '@/types/vibe-booking'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function ComparisonRenderer({ item, onAction }: Props) {
  const { items } = (item.payload as any).data
  return (
    <div className="p-4">
      <p className="font-semibold text-sm mb-3">Compare Options</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((t: any) => (
          <div key={t.id} className="rounded-lg border p-3 space-y-1 text-sm">
            <p className="font-medium">{t.name}</p>
            <p className="text-muted-foreground">${t.priceUsd} · {t.durationDays}d</p>
            {t.rating && <p className="text-xs">⭐ {t.rating}</p>}
            <button onClick={() => onAction('book_trip', t.id, { tripId: t.id })} className="w-full text-xs bg-primary text-primary-foreground rounded py-1 mt-1">Book</button>
          </div>
        ))}
      </div>
    </div>
  )
}
