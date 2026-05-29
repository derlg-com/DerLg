'use client'

import { useEffect, useState } from 'react'
import SplitScreenLayout from '@/components/vibe-booking/SplitScreenLayout'
import { useLanguageStore, languageStoreToWsLang } from '@/lib/i18n'

export default function VibeBookingPage() {
  const locale = useLanguageStore((s) => s.locale)
  const [userId, setUserId] = useState('guest')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('derlg:user_id')
    if (stored) setUserId(stored)
  }, [])

  return <SplitScreenLayout userId={userId} language={languageStoreToWsLang(locale)} />
}
