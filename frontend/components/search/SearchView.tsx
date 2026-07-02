'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search as SearchIcon, Clock, X, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { TripCard } from '@/components/trips/TripCard'
import { SearchResultCard } from './SearchResultCard'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { useSearchHistoryStore } from '@/stores/search-history.store'
import { POPULAR_SEARCHES, deriveSuggestions } from '@/lib/search-suggestions'
import { SEARCH_TYPES, type SearchResults, type SearchType } from '@/types/catalog'

export function countResults(data: SearchResults): number {
  return (
    data.trips.items.length +
    data.places.items.length +
    data.hotels.items.length +
    data.guides.items.length
  )
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

function GuidesList({ items }: { items: SearchResults['guides']['items'] }) {
  return (
    <div className="space-y-2">
      {items.map((g) => (
        <SearchResultCard
          key={g.id}
          href={`/guides/${g.id}`}
          imageUrl={g.profilePicture ?? null}
          title={g.name}
          subtitle={g.location}
        />
      ))}
    </div>
  )
}

function HotelsList({ items }: { items: SearchResults['hotels']['items'] }) {
  return (
    <div className="space-y-2">
      {items.map((h) => (
        <SearchResultCard
          key={h.id}
          href={`/hotels/${h.slug ?? h.id}`}
          imageUrl={h.coverImageUrl}
          title={h.name}
          subtitle={h.location}
        />
      ))}
    </div>
  )
}

function PlacesList({ items }: { items: SearchResults['places']['items'] }) {
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <SearchResultCard
          key={p.id}
          imageUrl={p.coverImageUrl}
          title={p.name}
          subtitle={p.province ?? p.category}
        />
      ))}
    </div>
  )
}

function TripsGrid({ items }: { items: SearchResults['trips']['items'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** A tappable suggestion / recent / popular term row. */
function TermRow({
  term,
  icon: Icon,
  onSelect,
  onRemove,
  removeLabel,
}: {
  term: string
  icon: typeof Clock
  onSelect: (term: string) => void
  onRemove?: (term: string) => void
  removeLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 hover:bg-muted">
      <button
        type="button"
        onClick={() => onSelect(term)}
        className="flex flex-1 items-center gap-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="line-clamp-1 text-sm text-foreground">{term}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={() => onRemove(term)}
          className="rounded-full p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

function Results({ data, type, t }: { data: SearchResults; type: SearchType; t: Translate }) {
  if (type === 'trip') return <TripsGrid items={data.trips.items} />
  if (type === 'hotel') return <HotelsList items={data.hotels.items} />
  if (type === 'guide') return <GuidesList items={data.guides.items} />
  if (type === 'place') return <PlacesList items={data.places.items} />
  return (
    <div className="space-y-6">
      {data.trips.items.length > 0 ? (
        <Section title={t('sections.trips')}>
          <TripsGrid items={data.trips.items} />
        </Section>
      ) : null}
      {data.hotels.items.length > 0 ? (
        <Section title={t('sections.hotels')}>
          <HotelsList items={data.hotels.items} />
        </Section>
      ) : null}
      {data.guides.items.length > 0 ? (
        <Section title={t('sections.guides')}>
          <GuidesList items={data.guides.items} />
        </Section>
      ) : null}
      {data.places.items.length > 0 ? (
        <Section title={t('sections.places')}>
          <PlacesList items={data.places.items} />
        </Section>
      ) : null}
    </div>
  )
}

export function SearchView() {
  const t = useTranslations('search')
  const router = useRouter()
  const params = useSearchParams()

  const historyTerms = useSearchHistoryStore((s) => s.terms)
  const addHistory = useSearchHistoryStore((s) => s.add)
  const removeHistory = useSearchHistoryStore((s) => s.remove)
  const clearHistory = useSearchHistoryStore((s) => s.clear)

  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [type, setType] = useState<SearchType>(() => {
    const raw = params.get('type')
    return SEARCH_TYPES.includes(raw as SearchType) ? (raw as SearchType) : 'all'
  })
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (debounced) qs.set('q', debounced)
    if (type !== 'all') qs.set('type', type)
    const str = qs.toString()
    router.replace(str ? `/search?${str}` : '/search')
  }, [debounced, type, router])

  // Record the committed (debounced) query into recent-search history. This is
  // the "search executed" signal the spec calls for (Requirements 20.6, 20.9).
  useEffect(() => {
    if (debounced.length >= 2) addHistory(debounced)
  }, [debounced, addHistory])

  const enabled = debounced.length >= 1
  const path = enabled ? `/v1/search${buildQuery({ q: debounced, type, limit: 20 })}` : null
  const { data, isLoading, error } = useApiQuery<SearchResults>(path)

  // Autocomplete suggestions while typing, derived from recent + popular terms.
  const suggestions = useMemo(() => deriveSuggestions(query, historyTerms), [query, historyTerms])
  const showSuggestions = query.trim().length >= 1 && suggestions.length > 0

  function select(term: string) {
    setQuery(term)
    setDebounced(term.trim())
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="pl-9"
        />
      </div>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4"
        role="tablist"
        aria-label={t('placeholder')}
      >
        {SEARCH_TYPES.map((tp) => (
          <button
            key={tp}
            type="button"
            role="tab"
            aria-selected={type === tp}
            onClick={() => setType(tp)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              type === tp
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            {t(`tabs.${tp}`)}
          </button>
        ))}
      </div>

      {showSuggestions ? (
        <Section title={t('suggestions')}>
          <div className="divide-y divide-border">
            {suggestions.map((term) => (
              <TermRow key={term} term={term} icon={SearchIcon} onSelect={select} />
            ))}
          </div>
        </Section>
      ) : null}

      {!enabled ? (
        <div className="space-y-6">
          {historyTerms.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('recent')}
                </h2>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('clearHistory')}
                </button>
              </div>
              <div className="divide-y divide-border">
                {historyTerms.map((term) => (
                  <TermRow
                    key={term}
                    term={term}
                    icon={Clock}
                    onSelect={select}
                    onRemove={removeHistory}
                    removeLabel={t('removeRecent', { term })}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <Section title={t('popular')}>
            <div className="divide-y divide-border">
              {POPULAR_SEARCHES.map((term) => (
                <TermRow key={term} term={term} icon={TrendingUp} onSelect={select} />
              ))}
            </div>
          </Section>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState title={t('errorTitle')} description={t('errorDesc')} />
      ) : data && countResults(data) === 0 ? (
        <EmptyState title={t('noResults', { query: debounced })} description={t('noResultsDesc')} />
      ) : data ? (
        <Results data={data} type={type} t={t} />
      ) : null}
    </div>
  )
}
