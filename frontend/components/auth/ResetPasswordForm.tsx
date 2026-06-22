'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { PasswordInput } from './PasswordInput'
import { useZodForm } from '@/lib/use-zod-form'
import { resetPasswordSchema, type ResetPasswordInput } from '@/schemas/auth'
import { resetPasswordRequest } from '@/lib/auth-api'
import { ApiError } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'

export function ResetPasswordForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const t = useTranslations('account')
  const { values, errors, setValue, validate } = useZodForm<ResetPasswordInput>(resetPasswordSchema, {
    token,
    newPassword: '',
    confirmPassword: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">{t('reset.invalidToken')}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">{t('forgot.title')}</Link>
        </Button>
      </div>
    )
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) return
    setSubmitting(true)
    resetPasswordRequest(data.token, data.newPassword)
      .then(() => onSuccess())
      .catch((err: unknown) => {
        setSubmitting(false)
        if (err instanceof ApiError && err.status === 400) setFormError(t('reset.invalidToken'))
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
        <Label htmlFor="newPassword">{t('fields.password')}</Label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => setValue('newPassword', e.target.value)}
          aria-invalid={Boolean(errors.newPassword)}
        />
        {errors.newPassword ? <p className="text-sm text-destructive">{errors.newPassword}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{t('fields.confirmPassword')}</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => setValue('confirmPassword', e.target.value)}
          aria-invalid={Boolean(errors.confirmPassword)}
        />
        {errors.confirmPassword ? (
          <p className="text-sm text-destructive">{errors.confirmPassword}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('reset.submit')}
      </Button>
    </form>
  )
}
