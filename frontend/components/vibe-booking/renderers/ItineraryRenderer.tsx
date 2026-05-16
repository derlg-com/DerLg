import type { ContentItem } from '@/types/vibe-booking'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function ItineraryRenderer({ item }: Props) {
  const { days } = (item.payload as any).data
  return (
    <div className="p-4 space-y-3">
      <p className="font-semibold text-sm">Itinerary</p>
      {days.map((d: any) => (
        <div key={d.day} className="border-l-2 border-primary pl-3">
          <p className="font-medium text-sm">Day {d.day}: {d.title}</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 space-y-0.5">
            {d.activities.map((a: string, i: number) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
