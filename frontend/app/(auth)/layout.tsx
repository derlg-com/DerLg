import type { ReactNode } from 'react'
import { Logo } from '@/components/shared/Logo'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo href="/" size="lg" />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
