'use client'

import { useState } from 'react'
import SplitScreenLayout from '@/components/vibe-booking/SplitScreenLayout'
import { useLanguageStore, languageStoreToWsLang } from '@/lib/i18n'
import { getStoredUserId } from '@/lib/auth'
import { getSessionFromUrl } from '@/lib/share'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'

export default function VibeBookingPage() {
  const locale = useLanguageStore((s) => s.locale)
  const [userId] = useState(getStoredUserId)

  // Resume a shared session before the WebSocket connects so the auth message
  // carries the shared session_id (full resumable share link).
  useState(() => {
    const shared = getSessionFromUrl()
    if (shared) useVibeBookingStore.getState().setSessionId(shared)
  })

  return <SplitScreenLayout userId={userId} language={languageStoreToWsLang(locale)} />
}
