'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthCard } from '@/components/auth/AuthCard'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { toast } from '@/components/ui/toast'
import { useTranslations } from '@/lib/i18n'

function ResetInner() {
  const router = useRouter()
  const params = useSearchParams()
  const t = useTranslations('account')
  const token = params.get('token') ?? ''
  return (
    <AuthCard title={t('reset.title')}>
      <ResetPasswordForm
        token={token}
        onSuccess={() => {
          toast({ title: t('reset.success'), variant: 'success' })
          router.replace('/login')
        }}
      />
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  )
}
