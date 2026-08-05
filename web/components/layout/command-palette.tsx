'use client'

import { Loader2, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'

import { Dialog } from '@/components/ui'
import { useSearch } from '@/hooks/use-catalog'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { localeTags, type Locale } from '@/lib/i18n/config'
import { useRouter } from '@/lib/i18n/navigation'

/** Detail route per search result kind. Unknown kinds are not navigable. */
const ROUTE_BY_KIND: Record<string, string> = {
  trip: '/trips',
  hotel: '/hotels',
  guide: '/guides',
  transport: '/transport',
  place: '/places',
}

/** Kinds the search tab labels cover; anything else shows the raw kind. */
const LABELLED_KINDS = new Set(['trip', 'hotel', 'guide', 'place'])

const DEBOUNCE_MS = 250

/**
 * Command palette: search from anywhere via Cmd/Ctrl+K.
 *
 * Implements the ARIA combobox-with-listbox pattern so arrow keys,
 * `aria-activedescendant` and the announced result count behave as screen reader
 * users expect, rather than being a bare input with a list under it.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('search')
  const shell = useTranslations('shell')
  const locale = useLocale() as Locale
  const router = useRouter()

  const [term, setTerm] = React.useState('')
  const [debouncedTerm, setDebouncedTerm] = React.useState('')
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Highlight is stored with the term it belongs to, so a new result set resets
  // it during render. Resetting in an effect would trigger a cascading render.
  const [highlight, setHighlight] = React.useState({ term: '', index: 0 })

  const { data, isFetching, isError } = useSearch(debouncedTerm, { limit: 8 })
  const results = data?.items ?? []

  const activeIndex =
    highlight.term === debouncedTerm && results.length > 0
      ? Math.min(highlight.index, results.length - 1)
      : 0

  const listboxId = React.useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  function onTermChange(next: string) {
    setTerm(next)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    // Debounced in a timer callback rather than an effect: fewer requests while
    // typing, without a setState-in-effect cascade.
    debounceTimer.current = setTimeout(() => setDebouncedTerm(next), DEBOUNCE_MS)
  }

  React.useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const close = React.useCallback(() => {
    onOpenChange(false)
    setTerm('')
    setDebouncedTerm('')
  }, [onOpenChange])

  const goTo = React.useCallback(
    (kind: string, id: string) => {
      const base = ROUTE_BY_KIND[kind]
      if (!base) return
      close()
      router.push(`${base}/${id}`)
    },
    [close, router],
  )

  function moveHighlight(next: number) {
    setHighlight({ term: debouncedTerm, index: next })
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveHighlight((activeIndex + 1) % results.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveHighlight((activeIndex - 1 + results.length) % results.length)
        break
      case 'Home':
        event.preventDefault()
        moveHighlight(0)
        break
      case 'End':
        event.preventDefault()
        moveHighlight(results.length - 1)
        break
      case 'Enter': {
        event.preventDefault()
        const result = results[activeIndex]
        if (result) goTo(result.kind, result.id)
        break
      }
      default:
        break
    }
  }

  function kindLabel(kind: string): string {
    if (!LABELLED_KINDS.has(kind)) return kind
    return t(`tabs.${kind}` as 'tabs.trip')
  }

  const trimmed = term.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < 2
  const showEmpty = debouncedTerm.trim().length >= 2 && !isFetching && results.length === 0

  return (
    <Dialog open={open} onClose={close} title={t('promptTitle')} description={t('promptDesc')}>
      <div className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            data-autofocus
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
            aria-label={t('placeholder')}
            placeholder={t('placeholder')}
            value={term}
            onChange={(event) => onTermChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface)] pr-10 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          {isFetching ? (
            <Loader2
              aria-hidden="true"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-[var(--text-tertiary)]"
            />
          ) : null}
        </div>

        {tooShort ? (
          <p className="px-1 text-sm text-[var(--text-tertiary)]">{shell('searchMinChars')}</p>
        ) : null}

        {isError ? (
          <div role="alert" className="px-1 text-sm text-[var(--text-danger)]">
            {t('errorTitle')} — {t('errorDesc')}
          </div>
        ) : null}

        {showEmpty ? (
          <div className="space-y-1 px-1 py-6 text-center">
            <p className="text-sm font-medium">{t('noResults', { query: debouncedTerm })}</p>
            <p className="text-sm text-[var(--text-secondary)]">{t('noResultsDesc')}</p>
          </div>
        ) : null}

        <ul id={listboxId} role="listbox" aria-label={t('promptTitle')} className="space-y-0.5">
          {results.map((result, index) => (
            <li
              key={`${result.kind}-${result.id}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                tabIndex={-1}
                // Pointer move rather than enter: the keyboard highlight stays put
                // when the mouse merely rests over the list.
                onPointerMove={() => moveHighlight(index)}
                onClick={() => goTo(result.kind, result.id)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm',
                  index === activeIndex ? 'bg-[var(--surface-hover)]' : 'bg-transparent',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{result.title}</span>
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                  {kindLabel(result.kind)}
                </span>
                {typeof result.basePriceUsd === 'number' ? (
                  <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                    {formatPrice(result.basePriceUsd, 'USD', localeTags[locale])}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}

/**
 * Owns the palette's open state and the global Cmd/Ctrl+K shortcut, so the
 * shortcut and the header button can never disagree.
 */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return { open, setOpen }
}
