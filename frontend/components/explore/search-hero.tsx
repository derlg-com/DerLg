'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search as SearchIcon, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import type { SearchType } from '@/types/catalog'

/** Hero search supports the most-booked surfaces (subset of SEARCH_TYPES). */
const HERO_TABS: SearchType[] = ['all', 'trip', 'hotel', 'guide']

/**
 * TripAdvisor-style hero: a big "Where to?" prompt, segmented category tabs,
 * and a pill search that routes to /search (preserving query + type), plus an
 * "Ask AI" entry into the conversational concierge at /vibe-booking.
 */
export function SearchHero() {
  const t = useTranslations('explore')
  const ts = useTranslations('search')
  const router = useRouter()
  const [type, setType] = useState<SearchType>('all')
  const [query, setQuery] = useState('')

  const submit = () => {
    const qs = new URLSearchParams()
    const q = query.trim()
    if (q) qs.set('q', q)
    if (type !== 'all') qs.set('type', type)
    const str = qs.toString()
    router.push(str ? `/search?${str}` : '/search')
  }

  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {t('hero.title')}
      </h1>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t('hero.title')}
      >
        {HERO_TABS.map((tp) => (
          <button
            key={tp}
            type="button"
            role="tab"
            aria-selected={type === tp}
            onClick={() => setType(tp)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              type === tp
                ? 'border-transparent bg-gradient-brand text-white shadow-glow'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            {ts(`tabs.${tp}`)}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-elevated sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('hero.placeholder')}
            aria-label={t('hero.placeholder')}
            className="h-11 border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-11 flex-1 gap-1.5 sm:flex-none">
            <Link href="/vibe-booking">
              <Sparkles className="h-4 w-4" aria-hidden />
              {t('hero.askAi')}
            </Link>
          </Button>
          <Button type="submit" className="h-11 flex-1 sm:flex-none">
            {t('hero.search')}
          </Button>
        </div>
      </form>
    </section>
  )
}
