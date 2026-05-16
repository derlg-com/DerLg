import type { ContentItem } from '@/types/vibe-booking'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function ImageGalleryRenderer({ item }: Props) {
  const { images } = (item.payload as any).data
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-1">
        {images.map((img: any, i: number) => (
          <img key={i} src={img.url} alt={img.caption ?? ''} className="w-full h-24 object-cover rounded" />
        ))}
      </div>
    </div>
  )
}
