import { MessageSquare, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/lib/i18n/navigation'

/**
 * Mid-page invitation into the AI concierge.
 *
 * Placed between shelves rather than only in the hero, because a user who has
 * scrolled past the first shelf without clicking is exactly the person who has
 * not found what they want by browsing.
 */
export async function ChatCallout() {
  const chat = await getTranslations('chat')
  const explore = await getTranslations('explore')
  const brand = await getTranslations('brand')

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          {/*
           * `--accent-subtle-text` (accent-800), not `--accent` (accent-600).
           * At 12px normal weight, accent-600 on the sunken surface measures
           * 4.22:1 — below the 4.5:1 WCAG AA minimum for small text. The subtle
           * token is the one meant for accent text ON a tinted surface, and it
           * inverts correctly in dark mode; the vivid accent stays on the button,
           * where it is a large-target background rather than small text.
           */}
          <p className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--accent-subtle-text)] uppercase">
            <Sparkles aria-hidden="true" className="size-3.5" />
            {chat('title')}
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {explore('hero.title')}
          </h2>
          <p className="max-w-xl text-sm text-[var(--text-secondary)]">{brand('subline')}</p>
        </div>

        <Link
          href="/chat"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)]"
        >
          <MessageSquare aria-hidden="true" className="size-4" />
          {explore('hero.askAi')}
        </Link>
      </div>
    </section>
  )
}
