'use client'

import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

/** Decorative branded panel shown beside auth forms on large screens. */
export function AuthBrandPanel() {
  const t = useTranslations('brand')
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-brand p-10 text-white lg:flex">
      <Link href="/" className="inline-flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
          <Leaf className="h-5 w-5" />
        </span>
        <span className="font-display text-xl font-extrabold">DerLg</span>
      </Link>
      <div className="space-y-3">
        <h2 className="font-display text-3xl font-bold leading-tight">{t('headline')}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-white/85">{t('subline')}</p>
      </div>
      <p className="text-sm text-white/70">{t('tagline')}</p>
      {/* decorative glow */}
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
    </aside>
  )
}
