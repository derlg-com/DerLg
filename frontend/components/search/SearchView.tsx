'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { TripCard } from '@/components/trips/TripCard'
import { SearchResultCard } from './SearchResultCard'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
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

  const enabled = debounced.length >= 1
  const path = enabled ? `/v1/search${buildQuery({ q: debounced, type, limit: 20 })}` : null
  const { data, isLoading, error } = useApiQuery<SearchResults>(path)

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

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label={t('placeholder')}>
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

      {!enabled ? (
        <EmptyState icon={SearchIcon} title={t('promptTitle')} description={t('promptDesc')} />
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
