import type { ContentItem } from '@/types/vibe-booking'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function TextSummaryRenderer({ item }: Props) {
  const { text } = (item.payload as any).data
  return <div className="p-4 text-sm">{text}</div>
}
