'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { useTranslations } from '@/lib/i18n'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const t = useTranslations('account')
  const returnUrl = params.get('returnUrl')
  const dest = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/'
  return (
    <AuthCard title={t('signIn.title')}>
      <LoginForm onSuccess={() => router.replace(dest)} />
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
