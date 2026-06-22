'use client'

import Link from 'next/link'
import { Landmark, Trees, Drama, Compass, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { TRIP_CATEGORIES, type TripCategory } from '@/types/catalog'

const CATEGORY_ICON: Record<TripCategory, LucideIcon> = {
  Temples: Landmark,
  Nature: Trees,
  Culture: Drama,
  Adventure: Compass,
  Food: UtensilsCrossed,
}

const CATEGORY_GRADIENT: Record<TripCategory, string> = {
  Temples: 'from-amber-600 to-orange-500',
  Nature: 'from-emerald-700 to-emerald-500',
  Culture: 'from-rose-600 to-pink-500',
  Adventure: 'from-sky-700 to-cyan-500',
  Food: 'from-red-600 to-amber-500',
}

/**
 * "Find things to do by interest" — square category tiles linking to the trips
 * catalog pre-filtered by category. Uses on-brand gradients + an icon (no
 * external image assets) with a bottom scrim so the white label stays AA-legible.
 */
export function CategoryTiles() {
  const t = useTranslations('trips')
  const te = useTranslations('explore')

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
        {te('categories.title')}
      </h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {TRIP_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICON[category]
          return (
            <Link
              key={category}
              href={`/trips?category=${category}`}
              className="group relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-br transition-transform duration-300 group-hover:scale-105',
                  CATEGORY_GRADIENT[category],
                )}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <Icon className="absolute right-2 top-2 h-6 w-6 text-white/90" aria-hidden />
              <span className="absolute inset-x-2 bottom-2 font-display text-sm font-semibold text-white drop-shadow">
                {t(`categories.${category}`)}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
