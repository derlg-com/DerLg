import type { ContentItem } from '@/types/vibe-booking'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function WeatherRenderer({ item }: Props) {
  const { forecast } = (item.payload as any).data
  return (
    <div className="p-4">
      <p className="font-semibold text-sm mb-3">5-Day Forecast</p>
      <div className="flex gap-2 overflow-x-auto">
        {forecast.map((d: any) => (
          <div key={d.date} className="flex-shrink-0 text-center text-xs p-2 rounded-lg bg-muted min-w-[60px]">
            <p className="font-medium">{new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}</p>
            <p className="text-lg">{d.icon ?? '🌤'}</p>
            <p>{d.high}° / {d.low}°</p>
          </div>
        ))}
      </div>
    </div>
  )
}
