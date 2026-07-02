'use client'

import { Search as SearchIcon, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTranslations } from '@/lib/i18n'

interface ExploreSearchProps {
  /** Current (raw, un-debounced) input value. */
  value: string
  onChange: (value: string) => void
  /** Accessible label / placeholder text. */
  label: string
  placeholder: string
}

/**
 * Debounced text-search input for the Explore → Places/Festivals tabs
 * (task 8.4, Requirement 4.5). Controlled by the parent tab, which debounces
 * the value (see {@link useDebounce}), pushes it to the URL `?q=` param, and
 * filters the loaded list client-side ({@link filterPlacesByQuery} /
 * {@link filterFestivalsByQuery}).
 *
 * Renders a leading search glyph and, when non-empty, a trailing clear button.
 */
export function ExploreSearch({ value, onChange, label, placeholder }: ExploreSearchProps) {
  const t = useTranslations('explore.search')

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      startIcon={<SearchIcon className="h-4 w-4" aria-hidden />}
      endIcon={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('clear')}
            className="pointer-events-auto flex items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : undefined
      }
    />
  )
}
