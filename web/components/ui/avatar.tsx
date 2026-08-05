import { cn } from '@/lib/cn'

/**
 * Avatar — initials fallback rather than a broken image, and a decorative
 * image is hidden from assistive tech since the name is already in the DOM.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const sizeClass = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' }[size]

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] font-medium text-[var(--text-secondary)]',
        sizeClass,
        className,
      )}
    >
      {src ? (
        // Avatars come from arbitrary remote hosts (guide photos in MinIO, OAuth
        // provider CDNs) that cannot all be allowlisted for next/image, so a
        // plain img with explicit dimensions is the correct trade-off here. The
        // size classes fix the box, so this does not contribute to layout shift.
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt="" aria-hidden="true" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials || '?'}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  )
}
