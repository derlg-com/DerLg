'use client'
import Image from 'next/image'
import { useState } from 'react'
import { BadgeCheck, User } from 'lucide-react'
import type { ContentItem } from '@/stores/vibe-booking.store'
import type { GuideCardsPayloadSchema } from '@/schemas/vibe-booking'
import type { z } from 'zod'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

type Data = z.infer<typeof GuideCardsPayloadSchema>['data']
type GuideItem = Data['guides'][number]

function GuideAvatar({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className="flex h-32 w-full items-center justify-center bg-muted text-muted-foreground">
        <User className="h-10 w-10" aria-hidden />
      </div>
    )
  }
  return (
    <div className="relative h-32 w-full">
      <Image
        src={src}
        alt={alt}
        fill
        loading="lazy"
        sizes="(min-width: 640px) 50vw, 100vw"
        className="object-cover"
        onError={() => setError(true)}
      />
    </div>
  )
}

export default function GuideCardsRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { guides } = item.data as Data

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {guides.map((guide: GuideItem) => (
          <div key={guide.id} className="overflow-hidden rounded-lg border border-border">
            <GuideAvatar src={guide.avatarUrl} alt={guide.name} />
            <div className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-sm font-semibold">{guide.name}</p>
                {guide.isVerified && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-primary">
                    <BadgeCheck size={14} aria-hidden /> {t('guides.card.verified')}
                  </span>
                )}
              </div>
              {guide.languages && guide.languages.length > 0 && (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {guide.languages.map((l) => l.toUpperCase()).join(' · ')}
                </p>
              )}
              {guide.province && (
                <p className="line-clamp-1 text-xs text-muted-foreground">{guide.province}</p>
              )}
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {formatCurrency(guide.pricePerDayUsd, locale)}
                </span>
                {t('guides.card.perDay')}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onAction('book_guide', guide.id, { guideId: guide.id })}
                  className="min-h-[44px] flex-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
                >
                  {t('content.bookNow')}
                </button>
                <button
                  onClick={() => onAction('view_guide_detail', guide.id, { guideId: guide.id })}
                  className="min-h-[44px] flex-1 rounded-md border border-border px-3 text-xs transition-colors hover:bg-muted active:bg-muted/70"
                >
                  {t('content.viewDetails')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
