'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ImageOff } from 'lucide-react'

export function TripGallery({ images, alt }: { images: string[]; alt: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const count = images?.length ?? 0

  useEffect(() => {
    if (lightbox === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : (i + 1) % count))
      if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : (i - 1 + count) % count))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightbox, count])

  if (count === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ImageOff className="h-10 w-10" aria-hidden />
      </div>
    )
  }

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(i)}
            className="relative aspect-[4/3] w-72 shrink-0 snap-start overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src={src} alt={`${alt} ${i + 1}`} fill sizes="288px" className="object-cover" />
          </button>
        ))}
      </div>

      {lightbox !== null && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
              role="dialog"
              aria-modal="true"
              aria-label="Image viewer"
              onClick={() => setLightbox(null)}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLightbox(null)}
                className="absolute right-4 top-4 rounded-md p-2 text-white/90 hover:bg-white/10"
              >
                <X className="h-6 w-6" />
              </button>
              {count > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLightbox((i) => (i === null ? i : (i - 1 + count) % count))
                    }}
                    className="absolute left-2 rounded-full p-2 text-white/90 hover:bg-white/10"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLightbox((i) => (i === null ? i : (i + 1) % count))
                    }}
                    className="absolute right-2 rounded-full p-2 text-white/90 hover:bg-white/10"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              ) : null}
              <div
                className="relative h-[80vh] w-[92vw]"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={images[lightbox]}
                  alt={`${alt} ${lightbox + 1}`}
                  fill
                  sizes="92vw"
                  className="object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
