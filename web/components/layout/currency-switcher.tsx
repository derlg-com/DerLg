'use client'

import { Check, Coins } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Popover, usePopoverClose } from '@/components/ui'
import { useCurrency } from '@/hooks/use-currency'
import { useHydrated } from '@/hooks/use-hydrated'
import { CURRENCIES, type Currency } from '@/lib/format'

const LABELS: Record<Currency, string> = {
  USD: 'USD $',
  KHR: 'KHR ៛',
  CNY: 'CNY ¥',
}

export function CurrencySwitcher({ className }: { className?: string }) {
  const t = useTranslations('shell')
  const { currency, setCurrency } = useCurrency()
  const hydrated = useHydrated()

  // The stored preference is unknown during SSR, so reserve the space instead of
  // rendering a guess that would flip after hydration.
  if (!hydrated) {
    return <div aria-hidden="true" className="h-10 w-24 pointer-coarse:h-11" />
  }

  return (
    <Popover
      label={t('currency')}
      align="end"
      className={className}
      trigger={
        <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border-default)] px-3 text-sm font-medium pointer-coarse:min-h-11">
          <Coins aria-hidden="true" className="size-4" />
          <span>{currency}</span>
        </span>
      }
    >
      <CurrencyOptions currency={currency} onSelect={setCurrency} />
    </Popover>
  )
}

function CurrencyOptions({
  currency,
  onSelect,
}: {
  currency: Currency
  onSelect: (next: Currency) => void
}) {
  const closePopover = usePopoverClose()

  return (
    <ul className="space-y-0.5">
      {CURRENCIES.map((option) => {
        const active = option === currency
        return (
          <li key={option}>
            <button
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => {
                onSelect(option)
                // Dismiss after choosing, so the menu does not linger.
                closePopover()
              }}
              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-sm px-2 text-left text-sm hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
            >
              <span>{LABELS[option]}</span>
              {active ? <Check aria-hidden="true" className="size-4 text-[var(--accent)]" /> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
