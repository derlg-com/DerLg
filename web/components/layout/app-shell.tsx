import { getTranslations } from 'next-intl/server'

import { BottomNav } from '@/components/layout/bottom-nav'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { OfflineBanner } from '@/components/layout/offline-banner'

/**
 * Application shell: skip link, offline banner, header, content, footer, and the
 * mobile bottom navigation.
 *
 * The layout is a flex column at least the height of the viewport, so short
 * pages still push the footer to the bottom instead of leaving it mid-screen.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('shell')

  return (
    <div className="flex min-h-dvh flex-col">
      {/* First focusable element, so keyboard users can bypass the navigation. */}
      <a
        href="#main"
        className="sr-only-focusable absolute top-2 left-2 z-50 rounded-md bg-[var(--surface)] px-3 py-2 text-sm font-medium ring-2 ring-[var(--focus-ring)]"
      >
        {t('skipToContent')}
      </a>

      <OfflineBanner />
      <Header />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
