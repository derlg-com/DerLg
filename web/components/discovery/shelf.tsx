import { getTranslations } from 'next-intl/server'

import { Link } from '@/lib/i18n/navigation'

/**
 * Section wrapper for a discovery shelf.
 *
 * One list, two presentations: a horizontal snap rail on narrow viewports and a
 * grid from `md` up. Rendering the children twice (once per layout) would
 * duplicate the DOM and make screen readers announce every card twice, so the
 * display mode is switched with CSS instead.
 *
 * No `tabIndex` on the scroll container: every card contains a link, so the
 * scrollable region already has focusable content and stays keyboard reachable.
 */
export async function Shelf({
  title,
  subtitle,
  href,
  children,
}: {
  title: string
  subtitle?: string
  /** "See all" target. */
  href: string
  children: React.ReactNode
}) {
  const explore = await getTranslations('explore')

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle ? <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          {explore('seeAll')}
        </Link>
      </div>

      <ul
        className={[
          // Mobile: snap rail. Negative margin lets cards bleed to the screen edge
          // while the section keeps its padding.
          'snap-rail -mx-4 scroll-px-4 px-4 pb-2',
          // md+: a plain grid, so the rail utilities stop applying.
          'md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4',
          '[&>li]:w-64 md:[&>li]:w-auto',
        ].join(' ')}
      >
        {children}
      </ul>
    </section>
  )
}
