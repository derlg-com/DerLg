'use client'

import { AuthCard } from '@/components/auth/AuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { useTranslations } from '@/lib/i18n'

export default function ForgotPasswordPage() {
  const t = useTranslations('account')
  return (
    <AuthCard title={t('forgot.title')}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
