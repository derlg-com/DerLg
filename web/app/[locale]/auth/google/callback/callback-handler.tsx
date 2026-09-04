'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'

import { Button, Card } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from '@/lib/i18n/navigation'

export function GoogleCallbackHandler() {
  const t = useTranslations('account')
  const searchParams = useSearchParams()
  const router = useRouter()
  const { loginWithGoogle } = useAuth()

  const [error, setError] = React.useState<string | null>(null)
  const processedRef = React.useRef(false)

  React.useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setError(t('callback.failed'))
      return
    }

    if (!code) {
      setError(t('callback.failed'))
      return
    }

    let next = '/'
    if (state) {
      try {
        const parsed = JSON.parse(atob(state))
        if (parsed.next && typeof parsed.next === 'string' && parsed.next.startsWith('/')) {
          next = parsed.next
        }
      } catch {
        // Fallback to '/'
      }
    }

    let redirectUri: string | undefined = undefined
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      if (origin === 'http://localhost:3000') {
        redirectUri = 'http://localhost:3000/auth/google/callback'
      } else if (origin === 'http://localhost:3001') {
        redirectUri = 'http://localhost:3001/auth/google/callback'
      }
    }

    loginWithGoogle
      .mutateAsync({ code, redirectUri, state: state ?? undefined })
      .then(() => {
        router.replace(next)
      })
      .catch(() => {
        setError(t('callback.failed'))
      })
  }, [searchParams, loginWithGoogle, router, t])

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
