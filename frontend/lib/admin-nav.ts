import {
  LayoutDashboard,
  CalendarCheck,
  LifeBuoy,
  Star,
  Siren,
  type LucideIcon,
} from 'lucide-react'

/**
 * Admin dashboard navigation model (Section 31). Labels are i18n key suffixes
 * resolved under the `admin.nav.*` namespace by the consuming component, so the
 * model stays language-neutral.
 */
export interface AdminNavItem {
  href: string
  /** i18n key under the `admin.nav` namespace. */
  labelKey: string
  icon: LucideIcon
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/bookings', labelKey: 'bookings', icon: CalendarCheck },
  { href: '/admin/support', labelKey: 'support', icon: LifeBuoy },
  { href: '/admin/reviews', labelKey: 'reviews', icon: Star },
  { href: '/admin/alerts', labelKey: 'alerts', icon: Siren },
]

/** Resolve the active admin nav item for a pathname (longest-prefix match). */
export function getActiveAdminHref(pathname: string): string | null {
  const match = ADMIN_NAV.filter((item) => pathname.startsWith(item.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0]
  return match?.href ?? null
}
