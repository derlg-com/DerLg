'use client'

import { User } from 'lucide-react'
import { EntityCard } from '@/components/shared/EntityCard'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { GuideSummary } from '@/types/catalog'

export function GuideCard({ guide }: { guide: GuideSummary }) {
  const t = useTranslations('guides')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <EntityCard
      href={`/guides/${guide.id}`}
      title={guide.name}
      favorite={{ type: 'guide', id: guide.id }}
      imageUrl={guide.profilePicture}
      imageAspect="square"
      fallbackIcon={User}
      badge={guide.isVerified ? { label: t('card.verified'), variant: 'success' } : undefined}
      rating={
        guide.ratingAverage != null && (guide.ratingCount ?? 0) > 0
          ? { average: guide.ratingAverage, count: guide.ratingCount }
          : undefined
      }
      subtitle={guide.languages && guide.languages.length > 0 ? guide.languages.join(' · ') : undefined}
      priceLabel={formatCurrency(guide.pricePerDayUsd, locale, currency)}
      priceSuffix={t('card.perDay')}
    />
  )
}
