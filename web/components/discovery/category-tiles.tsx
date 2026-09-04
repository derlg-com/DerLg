import { Compass, Landmark, Mountain, Trees, UtensilsCrossed } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/lib/i18n/navigation'
import { TRIP_CATEGORIES } from '@/schemas/domain'

/**
 * Trip category entry points.
 *
 * The category values are the backend's enum (`temples` | `nature` | `culture` |
 * `adventure` | `food`); the translation keys are capitalised in the ported
 * catalogue, so the two are mapped explicitly rather than by casing tricks.
 */
const CATEGORY_META = {
  temples: { Icon: Landmark, messageKey: 'Temples' },
  nature: { Icon: Trees, messageKey: 'Nature' },
  culture: { Icon: Compass, messageKey: 'Culture' },
  adventure: { Icon: Mountain, messageKey: 'Adventure' },
  food: { Icon: UtensilsCrossed, messageKey: 'Food' },
} as const satisfies Record<(typeof TRIP_CATEGORIES)[number], { Icon: unknown; messageKey: string }>

export async function CategoryTiles() {
  const trips = await getTranslations('trips')
  const explore = await getTranslations('explore')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium tracking-wide text-[var(--text-secondary)] uppercase">
        {explore('categories.title')}
      </h2>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TRIP_CATEGORIES.map((category) => {
          const { Icon, messageKey } = CATEGORY_META[category]
          return (
            <li key={category}>
              <Link
                href={`/trips?category=${category}`}
                className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0 text-[var(--accent)]" />
                <span className="truncate">
                  {trips(`categories.${messageKey}` as 'categories.Temples')}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
