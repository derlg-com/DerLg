'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'

export function BookNowCTA({ href, priceUsd }: { href: string; priceUsd: number }) {
  const t = useTranslations('trips')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('detail.from')}</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(priceUsd, locale, currency)}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={href}>{t('detail.bookNow')}</Link>
        </Button>
      </div>
    </div>
  )
}
