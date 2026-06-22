export type TabKey = 'home' | 'explore' | 'bookings' | 'chat' | 'profile'

export interface TabDef {
  key: TabKey
  href: string
  /** i18n key under the `shell` namespace. */
  labelKey: string
}

export const TABS: TabDef[] = [
  { key: 'home', href: '/', labelKey: 'nav.home' },
  { key: 'explore', href: '/search', labelKey: 'nav.explore' },
  { key: 'bookings', href: '/bookings', labelKey: 'nav.bookings' },
  { key: 'chat', href: '/vibe-booking', labelKey: 'nav.chat' },
  { key: 'profile', href: '/profile', labelKey: 'nav.profile' },
]

/** Bottom-nav tab roots that should NOT show a back button. */
export const TAB_ROOTS = ['/', '/search', '/bookings', '/profile', '/vibe-booking']

/** Resolve which bottom-nav tab should be highlighted for a given pathname. */
export function getActiveTab(pathname: string): TabKey | null {
  if (pathname === '/' || /^\/(trips|hotels|transportation|guides)(\/|$)/.test(pathname)) {
    return 'home'
  }
  if (pathname.startsWith('/search')) return 'explore'
  if (pathname.startsWith('/bookings') || pathname.startsWith('/checkout')) return 'bookings'
  if (pathname.startsWith('/vibe-booking')) return 'chat'
  if (pathname.startsWith('/profile')) return 'profile'
  return null
}

/** Whether the top bar should render a back button for this pathname. */
export function shouldShowBack(pathname: string): boolean {
  return !TAB_ROOTS.includes(pathname)
}
