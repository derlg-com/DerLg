import type { ReactNode } from 'react'
import { TopBar } from '@/components/shared/TopBar'
import { BottomNav } from '@/components/shared/BottomNav'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator'
import ChatLauncher from '@/components/vibe-booking/ChatLauncher'

/**
 * App shell for all authenticated/main routes. Server component that frames
 * pages with the top bar, offline banner, bottom tab navigation, and the
 * launchable AI concierge (floating bubble → slide-in side panel).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <OfflineBanner />
      <SyncStatusIndicator />
      <main className="flex-1 pb-20 animate-fade-in">{children}</main>
      <BottomNav />
      <ChatLauncher />
      <InstallPrompt />
    </div>
  )
}
