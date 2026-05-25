import type { ContentItem } from '@/stores/vibe-booking.store'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function TextSummaryRenderer({ item }: Props) {
  const { text } = (item.data as any)
  return <div className="p-4 text-sm">{text}</div>
}
