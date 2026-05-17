import type { ContentItem } from '@/stores/vibe-booking.store'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function TransportOptionsRenderer({ item, onAction }: Props) {
  const { options } = item.data as { options: Array<{ id: string; type: string; priceUsd: number; duration: string; departure?: string }> }
  return (
    <div className="p-4 space-y-2">
      {options.map((o) => (
        <div key={o.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
          <div>
            <p className="font-medium text-sm capitalize">{o.type}</p>
            <p className="text-xs text-muted-foreground">{o.duration}{o.departure ? ` · ${o.departure}` : ''}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-sm">${o.priceUsd}</p>
            <button onClick={() => onAction('select_transport', o.id, { optionId: o.id })} className="text-xs text-primary underline">Select</button>
          </div>
        </div>
      ))}
    </div>
  )
}
