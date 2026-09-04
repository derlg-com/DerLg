'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button } from '@/components/ui'
import { authApi } from '@/lib/api/auth'

export function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

export interface GoogleSignInButtonProps {
  next?: string
  className?: string
  disabled?: boolean
}

export function GoogleSignInButton({ next, className, disabled }: GoogleSignInButtonProps) {
  const t = useTranslations('account')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)

      const statePayload = {
        origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        next: next && next.startsWith('/') ? next : '/',
      }
      const state = btoa(JSON.stringify(statePayload))

      let redirectUri: string | undefined = undefined
      if (typeof window !== 'undefined') {
        const origin = window.location.origin
        // Match user registered URIs in Google Cloud Console
        if (origin === 'http://localhost:3000') {
          redirectUri = 'http://localhost:3000/auth/google/callback'
        } else if (origin === 'http://localhost:3001') {
          redirectUri = 'http://localhost:3001/auth/google/callback'
        }
      }

      const { url } = await authApi.getGoogleAuthUrl(redirectUri, state)
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to start Google sign in')
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        block
        loading={loading}
        disabled={disabled || loading}
        onClick={handleSignIn}
        className={className}
      >
        <GoogleIcon />
        <span>{t('googleSignIn')}</span>
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-[var(--text-danger)] text-center">
          {error}
        </p>
      ) : null}
    </div>
  )
}
