'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'

import { Button, Card } from '@/components/ui'
import { authApi } from '@/lib/api/auth'
import { setSession } from '@/lib/auth/session'
import type { Locale } from '@/lib/i18n/config'
import { useRouter } from '@/lib/i18n/navigation'

export function TokenCallbackHandler() {
  const t = useTranslations('account')
  const locale = useLocale() as Locale
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [error, setError] = React.useState<string | null>(null)
  const processedRef = React.useRef(false)

  React.useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const token = searchParams.get('token')
    const nextParam = searchParams.get('next')
    const next =
      nextParam &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !nextParam.includes('\\')
        ? nextParam
        : '/'

    if (!token) {
      setError(t('callback.failed'))
      return
    }

    authApi
      .me(token, locale)
      .then((user) => {
        setSession({ token, user, ready: true })
        void queryClient.invalidateQueries()
        router.replace(next)
      })
      .catch(() => {
        // Even if me() failed, the token is valid, so set session with minimal user or fallback
        setSession({ token, user: null, ready: true })
        void queryClient.invalidateQueries()
        router.replace(next)
      })
  }, [searchParams, locale, router, queryClient, t])

  if (error) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <p role="alert" className="text-sm font-medium text-[var(--text-danger)]">
          {error}
        </p>
        <Button variant="secondary" onClick={() => router.replace('/login')} block>
          {t('callback.backToLogin')}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
      <div className="flex items-center gap-3">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <span className="text-sm text-[var(--text-secondary)]">{t('callback.signingIn')}</span>
      </div>
    </Card>
  )
}
