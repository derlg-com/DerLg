'use client'

import { List, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import * as React from 'react'

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
import { PLACE_CATEGORIES } from '@/schemas/domain'

import type { MapMarker } from './leaflet-map'

/**
 * Leaflet reads `window` at import time and ships a sizeable bundle, so it is
 * loaded only in the browser and only for this view.
 */
const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

const DEFAULTS = {
  category: undefined as string | undefined,
  place: undefined as string | undefined,
}

export function ExploreMap() {
  const explore = useTranslations('explore')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)
  // Mobile shows one pane at a time; desktop shows both side by side.
  const [view, setView] = React.useState<'list' | 'map'>('list')

  const { data, isPending, isError, refetch } = usePlaces({
    limit: 50,
    category: filters.category,
  })

  // Memoised so the marker list below has a stable dependency.
  const places = React.useMemo(() => data?.items ?? [], [data])

  const markers: MapMarker[] = React.useMemo(
    () =>
      places
        // Only items with real coordinates can be mapped.
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

  function select(id: string) {
    setFilters({ place: id })
    // On mobile, choosing from the list should not leave the user on the map.
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
          onValueChange={setView}
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
          <Skeleton className="h-[60vh] w-full" />
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
                      className={cn('overflow-hidden', isSelected && 'border-[var(--accent)]')}
                    >
                      <button
                        type="button"
                        onClick={() => select(place.id)}
                        aria-pressed={isSelected}
                        className="flex w-full items-stretch gap-3 text-left"
                      >
                        <div className="w-28 shrink-0">
                          <CardMedia src={place.coverImage} ratio="1/1" sizes="112px" />
                        </div>
                        <CardContent className="min-w-0 flex-1 space-y-1 py-3 pr-3 pl-0">
                          <h2 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
                            {place.name}
                          </h2>
                          {place.category ? (
                            <p className="text-sm text-[var(--text-secondary)]">{place.category}</p>
                          ) : null}
                          <p className="text-sm text-[var(--text-tertiary)]">
                            {place.entryFeeUsd === 0
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
              'h-[70vh] min-w-0 overflow-hidden rounded-lg border border-[var(--border-subtle)]',
              view === 'list' && 'hidden lg:block',
            )}
          >
            <LeafletMap
              markers={markers}
              selectedId={selectedId}
              onSelect={(id) => setFilters({ place: id })}
              ariaLabel={explore('map.mapLabel')}
            />
          </section>
        </div>
      )}

      <PlaceSheet
        placeId={selected?.id ?? null}
        onClose={() => setFilters({ place: undefined })}
      />
    </div>
  )
}
