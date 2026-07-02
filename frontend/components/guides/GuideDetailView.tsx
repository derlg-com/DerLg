'use client'

import { useState } from 'react'
import { BadgeCheck, MapPin, Star, Award, User, MessageCircle } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { TripGallery } from '@/components/trips/TripGallery'
import { GuideAvailabilityChecker } from './GuideAvailabilityChecker'
import { GuideMessageModal } from './GuideMessageModal'
import { BookNowCTA } from '@/components/trips/BookNowCTA'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { ShareButton } from '@/components/shared/ShareButton'
import { CurrencySelector } from '@/components/trips/CurrencySelector'
import { CurrencyDisclaimer } from '@/components/trips/CurrencyDisclaimer'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations } from '@/lib/i18n'
import type { GuideDetail } from '@/types/catalog'

export function GuideDetailView({ id }: { id: string }) {
  const t = useTranslations('guides')
  const [messageOpen, setMessageOpen] = useState(false)
  const { data: g, isLoading, error, refetch } = useApiQuery<GuideDetail>(`/v1/guides/${id}`)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error || !g) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={User}
          title={error?.status === 404 ? t('detail.notFound') : t('error.title')}
          description={error?.status === 404 ? undefined : t('error.desc')}
          action={
            error?.status === 404 ? undefined : (
              <Button variant="outline" size="sm" onClick={refetch}>
                {t('error.retry')}
              </Button>
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 pb-36">
      <div className="flex items-start gap-4">
        <Avatar src={g.profilePicture} name={g.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {g.name}
            </h1>
            {g.isVerified ? <BadgeCheck className="h-5 w-5 text-success" aria-hidden /> : null}
          </div>
          {g.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden />
              {g.location}
            </p>
          ) : null}
          {g.ratingAverage != null && g.ratingCount > 0 ? (
            <span className="mt-1 inline-flex items-center gap-0.5 text-sm">
              <Star className="h-4 w-4 fill-rating text-rating" aria-hidden />
              {g.ratingAverage.toFixed(1)}
              <span className="text-muted-foreground">({g.ratingCount})</span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <FavoriteButton type="guide" id={g.id} />
          <ShareButton title={g.name} entity="guide" />
        </div>
      </div>

      {g.galleryImageUrls && g.galleryImageUrls.length > 0 ? (
        <TripGallery images={g.galleryImageUrls} alt={g.name} />
      ) : null}

      {g.bio ? <p className="text-sm leading-relaxed text-muted-foreground">{g.bio}</p> : null}

      <div className="flex flex-wrap gap-4">
        {g.languages && g.languages.length > 0 ? (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-foreground">{t('detail.languages')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {g.languages.map((l) => (
                <Badge key={l} variant="muted">
                  {l}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {g.specialties && g.specialties.length > 0 ? (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-foreground">
              {t('detail.specialties')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {g.specialties.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {g.experienceYears ? (
        <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Award className="h-4 w-4" aria-hidden />
          {t('detail.experienceYears', { n: g.experienceYears })}
        </p>
      ) : null}

      {g.certifications && g.certifications.length > 0 ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t('detail.certifications')}</h2>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {g.certifications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('detail.currency')}</p>
          <CurrencySelector className="w-28" />
        </div>
        <CurrencyDisclaimer />
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t('detail.availability')}
        </h2>
        <GuideAvailabilityChecker guideId={g.id} />
      </section>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setMessageOpen(true)}
      >
        <MessageCircle className="mr-1 h-4 w-4" aria-hidden />
        {t('message.cta')}
      </Button>

      <GuideMessageModal
        open={messageOpen}
        onOpenChange={setMessageOpen}
        guideId={g.id}
        guideName={g.name}
      />

      <BookNowCTA href={`/guides/${g.id}/book`} priceUsd={g.pricePerDayUsd} />
    </div>
  )
}
