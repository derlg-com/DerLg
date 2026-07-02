'use client'

import { useState } from 'react'
import { Ticket } from 'lucide-react'
import Link from 'next/link'
import { BookingShell } from '@/components/booking/BookingShell'
import { BookingCard } from './BookingCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'
import { type BookingGroup } from '@/lib/bookings-display'
import { useBookings } from '@/hooks/use-bookings'

const GROUPS: BookingGroup[] = ['upcoming', 'past', 'cancelled']

function MyTripsInner() {
  const t = useTranslations('bookings')
  const [tab, setTab] = useState<BookingGroup>('upcoming')
  const { grouped, isLoading, error, refetch } = useBookings()

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {t('list.title')}
      </h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as BookingGroup)}>
        <TabsList className="w-full">
          {GROUPS.map((g) => (
            <TabsTrigger key={g} value={g} className="flex-1">
              {t(`list.tabs.${g}`)}
              {grouped[g].length > 0 ? ` (${grouped[g].length})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-4">
            <EmptyState
              title={t('list.errorTitle')}
              description={t('list.errorDesc')}
              action={
                <Button variant="outline" size="sm" onClick={refetch}>
                  {t('list.retry')}
                </Button>
              }
            />
          </div>
        ) : (
          GROUPS.map((g) => (
            <TabsContent key={g} value={g}>
              {grouped[g].length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={t(`list.empty.${g}`)}
                  action={
                    g === 'upcoming' ? (
                      <Button asChild size="sm">
                        <Link href="/trips">{t('list.explore')}</Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {grouped[g].map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))
        )}
      </Tabs>
    </div>
  )
}

export function MyTripsView() {
  return (
    <BookingShell>
      <MyTripsInner />
    </BookingShell>
  )
}
