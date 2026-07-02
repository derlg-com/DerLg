import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Logo } from '@/components/shared/Logo'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { GuestOnlyGuard } from '@/components/auth/GuestOnlyGuard'

export const metadata: Metadata = {
  title: 'Sign in — DerLg',
  description:
    'Sign in or create your DerLg account to plan, book, and manage your Cambodia trips.',
  robots: { index: false, follow: false },
}

/**
 * Layout for the auth route group (login, register, forgot/reset password).
 * Deliberately omits the main app navigation (TopBar/BottomNav) and frames the
 * forms with a responsive split-screen: a branded panel on large viewports and
 * a centered form column with a mobile-only logo (Requirement 1.3). Guests only
 * — {@link GuestOnlyGuard} redirects already-authenticated users away.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo href="/" size="lg" />
          </div>
          <GuestOnlyGuard>{children}</GuestOnlyGuard>
        </div>
      </main>
    </div>
  )
}
