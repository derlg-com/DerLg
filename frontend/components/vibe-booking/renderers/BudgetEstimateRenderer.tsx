import type { ContentItem } from '@/types/vibe-booking'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function BudgetEstimateRenderer({ item }: Props) {
  const { totalUsd, breakdown } = (item.payload as any).data
  return (
    <div className="p-4 space-y-2">
      <p className="font-semibold text-sm">Budget Estimate</p>
      <p className="text-2xl font-bold">${totalUsd} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
      <div className="space-y-1">
        {Object.entries(breakdown).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="capitalize text-muted-foreground">{k}</span>
            <span>${v as number}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
