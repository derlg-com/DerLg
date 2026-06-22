'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { PasswordInput } from './PasswordInput'
import { useZodForm } from '@/lib/use-zod-form'
import { loginSchema, type LoginInput } from '@/schemas/auth'
import { loginRequest } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth.store'
import { ApiError } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations('account')
  const setSession = useAuthStore((s) => s.setSession)
  const { values, errors, setValue, validate } = useZodForm<LoginInput>(loginSchema, {
    email: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) return
    setSubmitting(true)
    loginRequest(data.email, data.password)
      .then((res) => {
        setSession(res.accessToken, res.user)
        onSuccess()
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        if (err instanceof ApiError && err.status === 401) setFormError(t('errors.invalidCredentials'))
        else if (err instanceof ApiError && err.status === 429) setFormError(t('errors.rateLimited'))
        else setFormError(t('errors.generic'))
      })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('fields.email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValue('email', e.target.value)}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('fields.password')}</Label>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            {t('signIn.forgot')}
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValue('password', e.target.value)}
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
      </div>
      <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('signIn.submit')}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t('signIn.noAccount')}{' '}
        <Link href="/register" className="text-primary hover:underline">
          {t('signIn.cta')}
        </Link>
      </p>
    </form>
  )
}
