'use client'
import Image from 'next/image'
import type { ContentItem } from '@/stores/vibe-booking.store'

interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
type Img = { url: string; caption?: string }

export default function ImageGalleryRenderer({ item }: Props) {
  const { images } = item.data as { images: Img[] }
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-1">
        {images.map((img, i) => (
          <div key={i} className="relative w-full h-24 rounded overflow-hidden">
            <Image
              src={img.url}
              alt={img.caption ?? ''}
              fill
              loading="lazy"
              sizes="(min-width: 640px) 33vw, 33vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
