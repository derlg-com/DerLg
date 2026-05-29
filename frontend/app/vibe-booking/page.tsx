'use client'

import { useState } from 'react'
import SplitScreenLayout from '@/components/vibe-booking/SplitScreenLayout'
import { useLanguageStore, languageStoreToWsLang } from '@/lib/i18n'

function getStoredUserId(): string {
  if (typeof window === 'undefined') return 'guest'
  return window.localStorage.getItem('derlg:user_id') ?? 'guest'
}

export default function VibeBookingPage() {
  const locale = useLanguageStore((s) => s.locale)
  const [userId] = useState(getStoredUserId)

  return <SplitScreenLayout userId={userId} language={languageStoreToWsLang(locale)} />
}
