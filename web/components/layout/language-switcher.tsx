'use client'

import { Check, Languages } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import * as React from 'react'

import { Popover } from '@/components/ui'
import { localeLabels, locales, type Locale } from '@/lib/i18n/config'
import { usePathname, useRouter } from '@/lib/i18n/navigation'

/**
 * Language switcher.
 *
 * Lists each language in its own script, not translated into the current one, so
 * a Khmer speaker looking at an English UI can still find "ខ្មែរ".
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [pending, setPending] = React.useState(false)

  function switchTo(next: Locale) {
    if (next === locale) return
    setPending(true)
    // Preserve dynamic segments (e.g. /trips/[id]) when swapping the locale.
    router.replace(
      // @ts-expect-error -- pathname is a validated route; params supplies its segments
      { pathname, params },
      { locale: next },
    )
  }

  return (
    <Popover
      label={localeLabels[locale]}
      align="end"
      className={className}
      trigger={
        <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border-default)] px-3 text-sm font-medium pointer-coarse:min-h-11">
          <Languages aria-hidden="true" className="size-4" />
          <span>{localeLabels[locale]}</span>
        </span>
      }
    >
      <ul className="space-y-0.5">
        {locales.map((option) => {
          const active = option === locale
          return (
            <li key={option}>
              <button
                type="button"
                lang={option}
                disabled={pending}
                aria-current={active ? 'true' : undefined}
                onClick={() => switchTo(option)}
                className="flex w-full min-h-10 items-center justify-between gap-3 rounded-sm px-2 text-left text-sm hover:bg-[var(--surface-hover)] disabled:opacity-50 pointer-coarse:min-h-11"
              >
                <span>{localeLabels[option]}</span>
                {active ? <Check aria-hidden="true" className="size-4 text-[var(--accent)]" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </Popover>
  )
}
