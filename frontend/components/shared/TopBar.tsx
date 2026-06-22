'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { getActiveTab, shouldShowBack } from '@/lib/nav'
import { Logo } from '@/components/shared/Logo'

const TITLE_KEYS: Record<string, string> = {
  '/search': 'nav.explore',
  '/bookings': 'nav.bookings',
  '/profile': 'nav.profile',
}

const SEGMENT_LABELS: Record<string, string> = {
  trips: 'Trips',
  hotels: 'Hotels',
  transportation: 'Transport',
  guides: 'Guides',
  checkout: 'Checkout',
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('shell')
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      if (y > lastY.current && y > 80) setHidden(true)
      else setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const showBack = shouldShowBack(pathname)
  const isHome = pathname === '/'
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? ''

  let title = t('brand')
  if (!isHome) {
    if (TITLE_KEYS[pathname]) title = t(TITLE_KEYS[pathname])
    else title = SEGMENT_LABELS[firstSegment] ?? t('brand')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 glass border-b border-border/60 transition-transform duration-200',
        hidden && '-translate-y-full',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        <div className="flex min-w-10 items-center">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label={t('back')}
              className="-ml-2 rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {isHome ? (
          <Logo href="/" size="sm" />
        ) : (
          <h1 className="flex-1 truncate text-center font-display text-base font-semibold text-foreground">
            {title}
          </h1>
        )}

        <div className="ml-auto flex min-w-10 items-center justify-end">
          {getActiveTab(pathname) !== 'explore' ? (
            <Link
              href="/search"
              aria-label={t('search')}
              className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-5 w-5" />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
