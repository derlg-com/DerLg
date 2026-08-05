import Image from 'next/image'

import { cn } from '@/lib/cn'

/**
 * Fixed-ratio media box for catalogue cards.
 *
 * The aspect ratio is set on the container and `next/image` fills it, so the
 * space is reserved before the image loads. That is what keeps cumulative layout
 * shift near zero on image-heavy rails.
 */
export function CardMedia({
  src,
  alt = '',
  ratio = '4/3',
  sizes,
  priority = false,
  className,
  children,
}: {
  src?: string | null
  /** Decorative by default: the card's heading already names the item. */
  alt?: string
  ratio?: '4/3' | '16/9' | '1/1' | '3/4'
  sizes?: string
  priority?: boolean
  className?: string
  /** Overlay content such as badges. */
  children?: React.ReactNode
}) {
  const ratioClass = {
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-video',
    '1/1': 'aspect-square',
    '3/4': 'aspect-[3/4]',
  }[ratio]

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-[var(--surface-sunken)]',
        ratioClass,
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
          priority={priority}
          className="object-cover"
        />
      ) : null}
      {children}
    </div>
  )
}
