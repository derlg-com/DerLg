'use client'

import { useState } from 'react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { authenticate } from '@/lib/auth'
import { useTranslations } from '@/lib/i18n'

interface Props {
  onAuthenticated: () => void
}

export default function LoginModal({ onAuthenticated }: Props) {
  const open = useVibeBookingStore((s) => s.authModalOpen)
  const setOpen = useVibeBookingStore((s) => s.setAuthModalOpen)
  const t = useTranslations()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await authenticate(mode, email.trim(), password)
      setOpen(false)
      setPassword('')
      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('auth.title')}
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">{t('auth.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('auth.subtitle')}</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.email')}
            aria-label={t('auth.email')}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            aria-label={t('auth.password')}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-primary hover:underline"
          >
            {mode === 'login' ? t('auth.needAccount') : t('auth.haveAccount')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:underline"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
