'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { PasswordInput } from './PasswordInput'
import { PasswordStrength } from './PasswordStrength'
import { useZodForm } from '@/lib/use-zod-form'
import { registerSchema, type RegisterInput } from '@/schemas/auth'
import { registerRequest } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth.store'
import { ApiError } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations('account')
  const setSession = useAuthStore((s) => s.setSession)
  const { values, errors, setValue, setError, validate, validateField } = useZodForm<RegisterInput>(
    registerSchema,
    {
      email: '',
      password: '',
      name: '',
      phone: '',
    },
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) return
    setSubmitting(true)
    registerRequest({
      email: data.email,
      password: data.password,
      name: data.name || undefined,
      phone: data.phone || undefined,
    })
      .then((res) => {
        setSession(res.accessToken, res.user)
        onSuccess()
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        if (err instanceof ApiError && err.status === 409) {
          setError('email', t('errors.emailExists'))
        } else if (err instanceof ApiError && err.status === 429) {
          setFormError(t('errors.rateLimited'))
        } else {
          setFormError(t('errors.generic'))
        }
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
          onBlur={() => validateField('email')}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t('fields.password')}</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValue('password', e.target.value)}
          onBlur={() => validateField('password')}
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-strength"
        />
        <PasswordStrength id="password-strength" password={values.password} />
        {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">{t('fields.name')}</Label>
        <Input
          id="name"
          autoComplete="name"
          value={values.name ?? ''}
          onChange={(e) => setValue('name', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('fields.phone')}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone ?? ''}
          onChange={(e) => setValue('phone', e.target.value)}
          onBlur={() => validateField('phone')}
          aria-invalid={Boolean(errors.phone)}
        />
        {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
      </div>
      <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
        {submitting ? (
          <Spinner size="sm" className="text-primary-foreground" />
        ) : (
          t('signUp.submit')
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t('signUp.haveAccount')}{' '}
        <Link href="/login" className="text-primary hover:underline">
          {t('signUp.cta')}
        </Link>
      </p>
    </form>
  )
}
