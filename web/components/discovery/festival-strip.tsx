'use client'

import { CalendarDays } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { CardMedia } from '@/components/shared/card-media'
import { Badge, Card, CardContent, ScrollRail, Skeleton } from '@/components/ui'
import { useFestivals } from '@/hooks/use-bff'

/**
 * Upcoming festivals strip.
 *
 * Client-side because festivals come through the BFF, which requires the
 * service key held on the server. A failure renders nothing: a missing strip is
 * better than an error block on the home page for content that is supplementary.
 */
export function FestivalStrip() {
  const t = useTranslations('festivals')
  const shell = useTranslations('shell')
  const format = useFormatter()
  const { data, isPending, isError } = useFestivals()

  if (isError) return null

  if (isPending) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-64 shrink-0" />
          ))}
        </div>
      </section>
    )
  }

  if (!data || data.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
        <CalendarDays aria-hidden="true" className="size-5 text-[var(--accent)]" />
        {shell('nav.festivals')}
      </h2>

      <ScrollRail label={shell('nav.festivals')}>
        {data.map((festival) => {
          // Festivals use snake_case dates, unlike every other endpoint.
          const start = festival.start_date ? new Date(festival.start_date) : null
          const valid = start !== null && !Number.isNaN(start.valueOf())

          return (
            <Card key={festival.id} as="article" className="w-72 overflow-hidden">
              <CardMedia src={festival.images?.[0]} ratio="16/9" sizes="288px" />
              <CardContent className="space-y-2 pt-4">
                <h3 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
                  {festival.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                  {valid ? <span>{format.dateTime(start, 'short')}</span> : null}
                  {festival.province ? <Badge tone="neutral">{festival.province}</Badge> : null}
                </div>
                {festival.description ? (
                  <p className="line-clamp-2 text-sm text-[var(--text-tertiary)]">
                    {festival.description}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </ScrollRail>

      <p className="sr-only">{t('detail.about')}</p>
    </section>
  )
}
