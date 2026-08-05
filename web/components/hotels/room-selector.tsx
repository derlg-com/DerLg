'use client'

import { Check, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingRegion,
  Skeleton,
} from '@/components/ui'
import { useHotelRooms } from '@/hooks/use-catalog'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'

/** Today and tomorrow as ISO dates, used as sensible initial values. */
function isoDate(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

/**
 * Room availability and selection.
 *
 * The backend requires both dates before it will return rooms, so the query stays
 * disabled until both are set rather than firing a request that must fail. Each
 * room's `available` flag comes from the requested range, so unavailable rooms are
 * shown as disabled instead of being hidden — seeing that a room exists but is
 * taken is more useful than an unexplained short list.
 */
export function RoomSelector({ hotelId }: { hotelId: string }) {
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')

  const [checkIn, setCheckIn] = React.useState(() => isoDate(1))
  const [checkOut, setCheckOut] = React.useState(() => isoDate(3))
  const [selected, setSelected] = React.useState<string | null>(null)

  const datesValid = checkIn !== '' && checkOut !== '' && checkOut > checkIn

  const { data, isPending, isFetching, isError, refetch } = useHotelRooms(hotelId, {
    checkIn: datesValid ? checkIn : undefined,
    checkOut: datesValid ? checkOut : undefined,
  })

  const selectedRoom = data?.find((room) => room.id === selected) ?? null

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{catalog('availability.rooms')}</h2>

      <div className="flex flex-wrap gap-3">
        <Field label={catalog('availability.checkIn')} className="w-40">
          {(props) => (
            <Input
              {...props}
              type="date"
              value={checkIn}
              min={isoDate(0)}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          )}
        </Field>
        <Field
          label={catalog('availability.checkOut')}
          className="w-40"
          // The message lives on the field, where it is programmatically
          // associated with the control, rather than being repeated in body text.
          error={datesValid ? undefined : catalog('availability.selectDates')}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={checkOut}
              // The backend rejects a checkout that is not after check-in.
              min={checkIn || isoDate(1)}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          )}
        </Field>
      </div>

      {!datesValid ? null : isPending || isFetching ? (
        <LoadingRegion label={catalog('availability.checking')}>
          <ul className="space-y-3">
            {Array.from({ length: 2 }, (_, index) => (
              <li key={index}>
                <Card className="p-4">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="mt-2 h-4 w-1/4" />
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
      ) : !data || data.length === 0 ? (
        <EmptyState title={catalog('availability.noRooms')} />
      ) : (
        <ul className="space-y-3">
          {data.map((room) => {
            const available = room.available !== false
            const isSelected = room.id === selected

            return (
              <li key={room.id}>
                <Card
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-4 p-4',
                    isSelected && 'border-[var(--accent)]',
                    !available && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{room.roomType}</h3>
                      {available ? (
                        <Badge tone="success">{catalog('availability.available')}</Badge>
                      ) : (
                        <Badge tone="danger">{catalog('availability.unavailable')}</Badge>
                      )}
                    </div>

                    {typeof room.maxOccupancy === 'number' ? (
                      <p className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                        <Users aria-hidden="true" className="size-3.5" />
                        {catalog('availability.sleeps', { count: room.maxOccupancy })}
                      </p>
                    ) : null}

                    {room.amenities && room.amenities.length > 0 ? (
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {room.amenities.join(' · ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-right">
                      <Price
                        amountUsd={room.priceUsd}
                        className="font-semibold text-[var(--text-primary)]"
                      />
                    </p>
                    <Button
                      variant={isSelected ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={!available}
                      onClick={() => setSelected(isSelected ? null : room.id)}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? (
                        <>
                          <Check aria-hidden="true" className="size-4" />
                          {catalog('availability.selected')}
                        </>
                      ) : (
                        catalog('availability.selectRoom')
                      )}
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {selectedRoom ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-[var(--accent)] p-4">
          <div>
            <p className="font-medium">{selectedRoom.roomType}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {checkIn} → {checkOut}
            </p>
          </div>
          <Link
            href={`/booking/new?type=hotel&id=${hotelId}&roomId=${selectedRoom.id}&checkIn=${checkIn}&checkOut=${checkOut}`}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)]"
          >
            {catalog('detail.bookNow')}
          </Link>
        </Card>
      ) : null}
    </section>
  )
}
