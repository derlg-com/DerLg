'use client'

import { useTranslations } from 'next-intl'

import { CardMedia } from '@/components/shared/card-media'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterChips } from '@/components/shared/filter-chips'
import { Pagination } from '@/components/shared/pagination'
import { Price } from '@/components/shared/price'
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Field,
  LoadingRegion,
  Select,
  Skeleton,
} from '@/components/ui'
import { useVehicles } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { Link } from '@/lib/i18n/navigation'
import { VEHICLE_TYPES, type VehicleSummary } from '@/schemas/domain'

const DEFAULTS = {
  // The backend DTO names this `type`; `vehicleType` is rejected outright.
  type: undefined as string | undefined,
  tier: undefined as string | undefined,
  subtype: undefined as string | undefined,
  page: undefined as string | undefined,
}

/** P3: subtypes from the backend VehicleSubtype enum, with implied seat counts. */
export const VEHICLE_SUBTYPES = ['starex', 'hiace', 'alphard', 'small_bus', 'big_bus'] as const

const PAGE_SIZE = 12

/** Renders `tuk_tuk` as "tuk tuk" without inventing a translation key. */
function readableType(value: string): string {
  return value.replace(/_/g, ' ')
}

/** small_bus -> Small bus. */
function readableLabel(value: string): string {
  const spaced = readableType(value)
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** P3: the group a vehicle belongs to — Normal, VIP, Bus or its own type. */
function tierGroup(vehicle: VehicleSummary): string {
  if (vehicle.tier === 'vip') return 'vip'
  if (vehicle.tier === 'normal') return 'normal'
  if (vehicle.vehicleType === 'bus') return 'bus'
  return vehicle.vehicleType
}

/** Groups a page of vehicles by tier, preserving the catalogue order within a group. */
function groupByTier(vehicles: VehicleSummary[]): { group: string; vehicles: VehicleSummary[] }[] {
  const order: string[] = []
  const map = new Map<string, VehicleSummary[]>()
  for (const vehicle of vehicles) {
    const group = tierGroup(vehicle)
    if (!map.has(group)) {
      map.set(group, [])
      order.push(group)
    }
    map.get(group)!.push(vehicle)
  }
  return order.map((group) => ({ group, vehicles: map.get(group)! }))
}

export function TransportBrowser() {
  const t = useTranslations('transportation')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')
  const search = useTranslations('search')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)
  const page = Number(filters.page ?? '1')

  const { data, isPending, isError, refetch } = useVehicles({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    type: filters.type,
    tier: filters.tier,
    subtype: filters.subtype,
  })

  return (
    <div className="space-y-6">
      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        <Field label={catalog('filters.vehicleType')} className="min-w-48">
          {(props) => (
            <Select
              {...props}
              value={filters.type ?? ''}
              onChange={(event) => setFilters({ type: event.target.value || undefined })}
            >
              <option value="">{catalog('filters.anyVehicle')}</option>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {readableType(type)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <FilterChips
          label={catalog('filters.tier')}
          value={filters.tier}
          onChange={(tier) => setFilters({ tier })}
          options={[
            { value: 'normal', label: catalog('tiers.normal') },
            { value: 'vip', label: catalog('tiers.vip') },
            { value: 'bus', label: catalog('tiers.bus') },
          ]}
        />

        <Field label={catalog('filters.subtype')} className="min-w-44">
          {(props) => (
            <Select
              {...props}
              value={filters.subtype ?? ''}
              onChange={(event) => setFilters({ subtype: event.target.value || undefined })}
            >
              <option value="">{catalog('filters.anySubtype')}</option>
              {VEHICLE_SUBTYPES.map((subtype) => (
                <option key={subtype} value={subtype}>
                  {readableLabel(subtype)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FilterBar>

      {isPending ? (
        <LoadingRegion label={common('loading')}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Card className="overflow-hidden">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <CardContent className="space-y-2 pt-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </LoadingRegion>
      ) : isError ? (
        <ErrorState
          title={common('error')}
          onRetry={() => void refetch()}
          retryLabel={common('tryAgain')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={search('noResultsDesc')}
          action={
            activeCount > 0 ? (
              <Link
                href="/transport"
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--border-default)] px-3 text-sm font-medium hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
              >
                {catalog('filters.clear')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {data.total}
          </p>

          {renderGroups(groupByTier(data.items), {
            t,
            catalog,
          })}

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={(next) => setFilters({ page: next === 1 ? undefined : String(next) })}
          />
        </>
      )}
    </div>
  )
}

function renderGroups(
  groups: { group: string; vehicles: VehicleSummary[] }[],
  { t, catalog }: { t: ReturnType<typeof useTranslations<'transportation'>>; catalog: ReturnType<typeof useTranslations<'catalog'>> },
) {
  // A single undifferentiated group renders as a plain grid, like before P3.
  const single = groups[0]
  if (groups.length === 1 && single) {
    return <VehicleGrid vehicles={single.vehicles} t={t} />
  }

  return (
    <div className="space-y-8">
      {groups.map(({ group, vehicles }) => (
        <section key={group} className="space-y-3" aria-label={tierLabel(group, catalog)}>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
            {tierLabel(group, catalog)}
          </h2>
          <VehicleGrid vehicles={vehicles} t={t} />
        </section>
      ))}
    </div>
  )
}

function tierLabel(group: string, catalog: ReturnType<typeof useTranslations<'catalog'>>): string {
  const key = `tiers.${group}` as never
  return catalog.has(key) ? catalog(key) : readableLabel(group)
}

function VehicleGrid({
  vehicles,
  t,
}: {
  vehicles: VehicleSummary[]
  t: ReturnType<typeof useTranslations<'transportation'>>
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <li key={vehicle.id}>
          <Card interactive as="article" className="h-full overflow-hidden">
            <Link
              href={`/transport/${vehicle.id}`}
              className="block h-full focus-visible:outline-none"
            >
              <CardMedia src={vehicle.coverImage} ratio="16/9" />
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
                    {vehicle.name}
                  </h3>
                  {vehicle.tier === 'vip' ? (
                    <Badge tone="accent" className="shrink-0">
                      {readableLabel(vehicle.tier)}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* P3: the subtype IS the vehicle (Starex, Hiace, Alphard,
                      small/big bus); fall back to the type until it ships. */}
                  <Badge tone="neutral">{readableLabel(vehicle.subtype ?? vehicle.vehicleType)}</Badge>
                  {vehicle.tier === 'normal' ? (
                    <Badge tone="neutral">{readableLabel(vehicle.tier)}</Badge>
                  ) : null}
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {t('card.seats', { n: vehicle.capacity })}
                  </span>
                  {vehicle.province ? (
                    <span className="text-xs text-[var(--text-tertiary)]">· {vehicle.province}</span>
                  ) : null}
                </div>

                <p className="text-sm">
                  <Price
                    amountUsd={vehicle.priceUsd}
                    className="font-semibold text-[var(--text-primary)]"
                    // The pricing model matters: $6 per km is not $6 per trip.
                    suffix={vehicle.pricingModel ? readableType(vehicle.pricingModel) : undefined}
                  />
                </p>
              </CardContent>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  )
}
