'use client'

import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { useTranslations } from '@/lib/i18n'
import {
  PLACE_CATEGORIES,
  PLACE_PRICE_FILTERS,
  type PlaceCategoryFilter,
  type PlacePriceFilter,
} from '@/types/explore'

interface PlaceFiltersProps {
  category: PlaceCategoryFilter | null
  price: PlacePriceFilter
  onCategoryChange: (category: PlaceCategoryFilter | null) => void
  onPriceChange: (price: PlacePriceFilter) => void
}

/**
 * Filter controls for the Explore → Places tab: a horizontally scrollable row
 * of category chips (mirroring {@link CategoryRow}) plus a price-range select.
 * Selections are lifted to the parent, which persists them in the URL query
 * (Requirement 4.7, 4.8) and refetches/filters in real time.
 */
export function PlaceFilters({
  category,
  price,
  onCategoryChange,
  onPriceChange,
}: PlaceFiltersProps) {
  const t = useTranslations('explore.places')
  const chip =
    'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const activeChip = 'border-transparent bg-gradient-brand text-white shadow-glow'
  const idleChip = 'border-border bg-background text-foreground hover:bg-muted'

  return (
    <div className="space-y-3">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label={t('filters.categoryLabel')}
      >
        <button
          type="button"
          aria-pressed={category === null}
          onClick={() => onCategoryChange(null)}
          className={cn(chip, category === null ? activeChip : idleChip)}
        >
          {t('categories.all')}
        </button>
        {PLACE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => onCategoryChange(c)}
            className={cn(chip, category === c ? activeChip : idleChip)}
          >
            {t(`categories.${c}`)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <div className="w-44">
          <Select
            value={price}
            onChange={(e) => onPriceChange(e.target.value as PlacePriceFilter)}
            aria-label={t('filters.priceLabel')}
          >
            {PLACE_PRICE_FILTERS.map((p) => (
              <option key={p} value={p}>
                {t(`filters.price.${p}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}
