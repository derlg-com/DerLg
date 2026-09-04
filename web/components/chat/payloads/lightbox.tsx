'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button, Dialog } from '@/components/ui'
import { cn } from '@/lib/cn'
import { safeImageSrc } from '@/lib/url-safety'

export interface LightboxImage {
  url: string
  caption?: string
}

/**
 * Full-size photo viewer for agent-supplied galleries.
 *
 * Spec §6 lets the user ask "can I see photos?", and a 160px thumbnail rail is not
 * an answer to that — travellers judge a hotel room by looking at it. So the rail
 * stays as the index and this is the actual view.
 *
 * Built on the existing Dialog, which already owns the modal contract (portal,
 * focus trap, scroll lock, Escape, labelling). Only the arrow-key paging is new,
 * because a photo viewer where the keyboard cannot move between photos is a
 * viewer only a mouse user can use.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  title,
}: {
  images: LightboxImage[]
  /** Open when non-null. */
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  title: string
}) {
  const t = useTranslations('content')

  const open = index !== null
  const total = images.length

  const step = React.useCallback(
    (delta: number) => {
      if (index === null || total === 0) return
      // Wraps: at the last photo, "next" returning to the first beats a dead key.
      onIndexChange((index + delta + total) % total)
    },
    [index, onIndexChange, total],
  )

  React.useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, step])

  if (index === null) return null
  const current = images[index]
  if (!current) return null
  // Agent-supplied URL: scheme-checked before it reaches the DOM.
  const currentSrc = safeImageSrc(current.url)

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={t('galleryPosition', { index: index + 1, total })}
      className="max-w-3xl"
    >
      <figure className="flex flex-col gap-3">
        <div className="relative flex items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)]">
          {/* Runtime URL from the agent, so a plain <img> rather than next/image. */}
          {currentSrc ? (
            <LightboxImage
              src={currentSrc}
              alt={current.caption ?? `${title} ${index + 1}`}
              unavailableText={t('imageUnavailable')}
            />
          ) : (
            <p className="p-8 text-sm text-[var(--text-tertiary)]">{t('imageUnavailable')}</p>
          )}

          {total > 1 ? (
            <>
              <LightboxArrow side="left" label={t('galleryPrevious')} onClick={() => step(-1)} />
              <LightboxArrow side="right" label={t('galleryNext')} onClick={() => step(1)} />
            </>
          ) : null}
        </div>

        {current.caption ? (
          <figcaption className="text-sm text-[var(--text-secondary)]">
            {current.caption}
          </figcaption>
        ) : null}

        {total > 1 ? (
          <ul className="flex gap-1.5 overflow-x-auto pb-1" aria-label={title}>
            {images.map((image, thumbIndex) => (
              <li key={`${image.url}-${thumbIndex}`}>
                <button
                  type="button"
                  onClick={() => onIndexChange(thumbIndex)}
                  aria-current={thumbIndex === index}
                  aria-label={t('galleryPosition', { index: thumbIndex + 1, total })}
                  className={cn(
                    'size-14 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                    thumbIndex === index
                      ? 'border-[var(--accent)]'
                      : 'border-transparent opacity-60 hover:opacity-100',
                  )}
                >
                  <Thumb src={image.url} alt="" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </figure>
    </Dialog>
  )
}

function LightboxArrow({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right'
  label: string
  onClick: () => void
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 shadow-sm',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  )
}

/**
 * Thumbnail rail that opens the lightbox.
 *
 * Shared by the transcript's gallery block and the workspace panel so a photo set
 * behaves identically wherever it appears.
 */
export function GalleryRail({
  images,
  title,
  className,
  thumbClassName,
}: {
  images: LightboxImage[]
  title: string
  className?: string
  thumbClassName?: string
}) {
  const t = useTranslations('content')
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  /*
   * A new photo set invalidates the open index: the workspace swaps galleries when
   * the subject changes, and index 5 of the old set may not exist in the new one —
   * or worse, may be a different picture under the previous caption.
   *
   * State rather than a ref, and compared during render rather than in an effect:
   * this is React's documented "adjust state when a prop changes" pattern, and it
   * closes the viewer before the wrong image can be painted.
   */
  const fingerprint = images.map((image) => image.url).join('|')
  const [seenFingerprint, setSeenFingerprint] = React.useState(fingerprint)
  if (seenFingerprint !== fingerprint) {
    setSeenFingerprint(fingerprint)
    if (openIndex !== null) setOpenIndex(null)
  }

  if (images.length === 0) return null

  return (
    <>
      <ul
        aria-label={title}
        className={cn(
          'flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1',
          'sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0',
          className,
        )}
      >
        {images.map((image, index) => (
          <li
            key={`${image.url}-${index}`}
            className={cn('w-40 shrink-0 snap-start sm:w-auto', thumbClassName)}
          >
            <figure className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={t('galleryOpen', { index: index + 1, total: images.length })}
                className={cn(
                  'relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)]',
                  'transition-opacity duration-[var(--duration-fast)] hover:opacity-90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                )}
              >
                {/*
                 * Falls back to a positional description rather than an empty alt:
                 * these are content images, so they are not decorative.
                 */}
                <Thumb src={image.url} alt={image.caption ?? `${title} ${index + 1}`} />
              </button>
              {image.caption ? (
                <figcaption className="text-xs text-[var(--text-tertiary)]">
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>

      <ImageLightbox
        images={images}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
        title={title}
      />
    </>
  )
}

function LightboxImage({
  src,
  alt,
  unavailableText,
}: {
  src: string
  alt: string
  unavailableText: string
}) {
  const [hasError, setHasError] = React.useState(false)
  if (hasError) {
    return <p className="p-8 text-sm text-[var(--text-tertiary)]">{unavailableText}</p>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="max-h-[60dvh] w-full object-contain"
      decoding="async"
      onError={() => setHasError(true)}
    />
  )
}

/**
 * Gallery thumbnail.
 *
 * Renders nothing when the source is rejected. An `<img>` with `src=""` is not
 * inert: browsers resolve the empty string to the CURRENT PAGE and fetch it again,
 * so a hostile URL would cost a duplicate page load per thumbnail.
 */
function Thumb({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = React.useState(false)
  const safe = safeImageSrc(src)
  if (!safe) return null

  if (hasError) {
    return (
      <div className="size-full flex items-center justify-center bg-[var(--surface-sunken)] text-[var(--text-tertiary)] text-[10px] p-1 text-center">
        {alt}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safe}
      alt={alt}
      className="size-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
    />
  )
}
