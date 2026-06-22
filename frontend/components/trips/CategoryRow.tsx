'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { TRIP_CATEGORIES, type TripCategory } from '@/types/catalog'

interface CategoryRowProps {
  selected: TripCategory | null
  onSelect: (category: TripCategory | null) => void
}

export function CategoryRow({ selected, onSelect }: CategoryRowProps) {
  const t = useTranslations('trips')
  const chip =
    'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const activeChip = 'border-transparent bg-gradient-brand text-white shadow-glow'
  const idleChip = 'border-border bg-background text-foreground hover:bg-muted'

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('home.categories')}>
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={cn(chip, selected === null ? activeChip : idleChip)}
      >
        {t('categories.all')}
      </button>
      {TRIP_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={selected === category}
          onClick={() => onSelect(category)}
          className={cn(chip, selected === category ? activeChip : idleChip)}
        >
          {t(`categories.${category}`)}
        </button>
      ))}
    </div>
  )
}
