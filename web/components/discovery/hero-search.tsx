'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { useRouter } from '@/lib/i18n/navigation'

/**
 * Hero search field.
 *
 * Submits to the trips list rather than opening the palette, because a user who
 * typed a full phrase expects a results page they can filter and share, not a
 * transient overlay. The palette remains available via ⌘K for quick jumps.
 */
export function HeroSearch() {
  const explore = useTranslations('explore')
  const router = useRouter()
  const [term, setTerm] = React.useState('')

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = term.trim()
    // The backend rejects terms shorter than two characters.
    if (trimmed.length < 2) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex max-w-xl gap-2">
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
        <input
          type="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label={explore('hero.placeholder')}
          placeholder={explore('hero.placeholder')}
          className="min-h-12 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface)] pr-3 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-12 shrink-0 items-center rounded-md border border-[var(--border-default)] bg-[var(--surface)] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
      >
        {explore('hero.search')}
      </button>
    </form>
  )
}
