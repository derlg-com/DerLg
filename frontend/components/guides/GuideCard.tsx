'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BadgeCheck, Star, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { GuideSummary } from '@/types/catalog'

export function GuideCard({ guide }: { guide: GuideSummary }) {
  const t = useTranslations('guides')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const href = `/guides/${guide.id}`

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-square bg-muted">
          {guide.profilePicture ? (
            <Image
              src={guide.profilePicture}
              alt={guide.name}
              fill
              sizes="(max-width: 640px) 50vw, 300px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <User className="h-10 w-10" aria-hidden />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <FavoriteButton type="guide" id={guide.id} />
          </div>
          {guide.isVerified ? (
            <Badge variant="success" className="absolute left-2 top-2">
              <BadgeCheck className="h-3 w-3" aria-hidden /> {t('card.verified')}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="line-clamp-1 font-medium text-foreground">{guide.name}</h3>
            {guide.ratingAverage != null && guide.ratingCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-foreground">
                <Star className="h-3.5 w-3.5 fill-rating text-rating" aria-hidden />
                {guide.ratingAverage.toFixed(1)}
              </span>
            ) : null}
          </div>
          {guide.languages && guide.languages.length > 0 ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {guide.languages.join(' · ')}
            </p>
          ) : null}
          <p className="pt-1 text-sm">
            <span className="font-semibold text-foreground">
              {formatCurrency(guide.pricePerDayUsd, locale, currency)}
            </span>{' '}
            <span className="text-xs text-muted-foreground">{t('card.perDay')}</span>
          </p>
        </div>
      </Card>
    </Link>
  )
}
