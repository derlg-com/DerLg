'use client'

import { useRouter } from 'next/navigation'
import { AuthCard } from '@/components/auth/AuthCard'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useTranslations } from '@/lib/i18n'

export default function RegisterPage() {
  const router = useRouter()
  const t = useTranslations('account')
  return (
    <AuthCard title={t('signUp.title')}>
      <RegisterForm onSuccess={() => router.replace('/')} />
    </AuthCard>
  )
}
