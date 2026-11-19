'use client'

import { List, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { NavelDestinationMapCard } from '@/components/discovery/navel-destination-map-card'
import { PlaceSheet } from '@/components/map/place-sheet'
import { CardMedia } from '@/components/shared/card-media'
import { FilterBar } from '@/components/shared/filter-bar'
import {
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Field,
  LoadingRegion,
  SegmentedControl,
  Select,
  Skeleton,
} from '@/components/ui'
import { usePlaces } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { cn } from '@/lib/cn'
import type { Paginated } from '@/lib/api/errors'
import { PLACE_CATEGORIES, type PlaceSummary } from '@/schemas/domain'

import type { MapMarker } from './leaflet-map'

/**
 * Leaflet is client-only.
 */
const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-[24px]" />,
})

const DEFAULTS = {
  category: undefined as string | undefined,
  place: undefined as string | undefined,
}

export function ExploreMap({
  initialData,
}: {
  initialData?: Paginated<PlaceSummary>
} = {}) {
  const explore = useTranslations('explore')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)
  const [view, setView] = React.useState<'map' | 'list'>('list')
  const carouselRef = React.useRef<HTMLDivElement>(null)

  const { data, isPending, isError, refetch } = usePlaces(
    {
      limit: 50,
      category: filters.category,
    },
    !filters.category && initialData ? { initialData } : undefined,
  )

  const places = React.useMemo(() => data?.items ?? [], [data])

  const markers: MapMarker[] = React.useMemo(
    () =>
      places
        .filter((place) => place.latitude != null && place.longitude != null)
        .map((place) => ({
          id: place.id,
          latitude: place.latitude!,
          longitude: place.longitude!,
          label: place.name,
          kind: 'place' as const,
        })),
    [places],
  )

  const selectedId = filters.place ?? null
  const selected = places.find((place) => place.id === selectedId) ?? null

  // When selectedId changes, auto-scroll the carousel to that card
  React.useEffect(() => {
    if (!selectedId || !carouselRef.current) return
    const cardEl = carouselRef.current.querySelector(`[data-place-id="${selectedId}"]`)
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [selectedId])

  function selectPlace(id: string) {
    setFilters({ place: id })
    setView('list')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar activeCount={activeCount} onClear={clearFilters}>
          <Field label={catalog('filters.placeCategory')} className="min-w-44">
            {(props) => (
              <Select
                {...props}
                value={filters.category ?? ''}
                onChange={(event) =>
                  setFilters({ category: event.target.value || undefined, place: undefined })
                }
              >
                <option value="">{catalog('filters.anyPlace')}</option>
                {PLACE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FilterBar>

        {/* Pane switch on mobile only; both panes are visible from lg up. */}
        <SegmentedControl
          label={explore('map.viewMode')}
          value={view}
          onValueChange={(val) => setView(val as 'list' | 'map')}
          className="lg:hidden"
          options={[
            {
              value: 'list',
              label: explore('map.viewList'),
              icon: <List aria-hidden="true" className="size-4" />,
            },
            {
              value: 'map',
              label: explore('map.viewMap'),
              icon: <MapPin aria-hidden="true" className="size-4" />,
            },
          ]}
        />
      </div>

      {isPending ? (
        <LoadingRegion label={common('loading')}>
          <Skeleton className="h-[60vh] w-full rounded-[28px]" />
        </LoadingRegion>
      ) : isError ? (
        <ErrorState
          title={common('error')}
          onRetry={() => void refetch()}
          retryLabel={common('tryAgain')}
        />
      ) : places.length === 0 ? (
        <EmptyState title={explore('tabs.placesPlaceholder')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* List pane */}
          <section
            aria-label={explore('map.listLabel')}
            className={cn('min-w-0', view === 'map' && 'hidden lg:block')}
          >
            <ul className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
              {places.map((place) => {
                const isSelected = place.id === selectedId
                return (
                  <li key={place.id}>
                    <Card
                      as="article"
                      interactive
                      className={cn(
                        'overflow-hidden rounded-[24px] border-2 transition-all',
                        isSelected
                          ? 'border-[var(--color-navel-jade)] ring-2 ring-[var(--color-navel-jade)]/20'
                          : 'border-[var(--border-subtle)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectPlace(place.id)}
                        aria-pressed={isSelected}
                        className="flex w-full items-stretch gap-3 text-left p-2.5"
                      >
                        <div className="w-24 h-24 shrink-0 overflow-hidden rounded-2xl">
                          <CardMedia src={place.coverImage} ratio="1/1" sizes="96px" />
                        </div>
                        <CardContent className="min-w-0 flex-1 space-y-1 py-1 pr-2 pl-0">
                          <h2 className="line-clamp-1 text-sm font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
                            {place.name}
                          </h2>
                          {place.category ? (
                            <span className="inline-block rounded-full bg-[var(--color-navel-cream)]/80 dark:bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {place.category}
                            </span>
                          ) : null}
                          <p className="text-xs font-semibold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-gold)] pt-1">
                            {place.entryFeeUsd === 0 || place.entryFeeUsd == null
                              ? catalog('detail.free')
                              : `${catalog('detail.entryFee')}: $${place.entryFeeUsd}`}
                          </p>
                        </CardContent>
                      </button>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Map pane */}
          <section
            aria-label={explore('map.mapLabel')}
            className={cn(
              'min-w-0 flex flex-col gap-3',
              view === 'list' && 'hidden lg:block',
            )}
          >
            <div className="h-[52vh] sm:h-[58vh] lg:h-[70vh] w-full overflow-hidden rounded-[28px] border border-[var(--border-subtle)] shadow-sm relative">
              <LeafletMap
                markers={markers}
                selectedId={selectedId}
                onSelect={(id) => setFilters({ place: id })}
                ariaLabel={explore('map.mapLabel')}
              />
            </div>

            {/* Bottom Destination Carousel visible in mobile map view */}
            <div className="space-y-2 lg:hidden">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[var(--text-secondary)]">
                  {places.length} places found
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  Swipe to explore
                </span>
              </div>

              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
              >
                {places.map((place) => (
                  <div key={place.id} data-place-id={place.id}>
                    <NavelDestinationMapCard
                      id={place.id}
                      name={place.name}
                      category={place.category}
                      coverImage={place.coverImage}
                      entryFeeUsd={place.entryFeeUsd}
                      ratingAverage={4.8}
                      location={place.category || 'Cambodia'}
                      isSelected={place.id === selectedId}
                      onSelect={() => selectPlace(place.id)}
                      onOpenDetails={() => selectPlace(place.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Place details modal */}
      <PlaceSheet
        placeId={selected?.id ?? null}
        onClose={() => setFilters({ place: undefined })}
      />
    </div>
  )
}
