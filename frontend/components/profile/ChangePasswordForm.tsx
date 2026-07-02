'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookingShell } from '@/components/booking/BookingShell'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { useZodForm } from '@/lib/use-zod-form'
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas/auth'
import { changePasswordRequest } from '@/lib/auth-api'
import { changePasswordErrorKey } from '@/lib/change-password-error'
import { useTranslations } from '@/lib/i18n'

/**
 * Authenticated password-change form (Requirement 8.5).
 *
 * Collects the current password, a new password (validated for strength /
 * minimum length and confirmation match via {@link changePasswordSchema}), and
 * calls {@link changePasswordRequest}.
 *
 * ⚠️ The backend `POST /v1/auth/change-password` endpoint does not exist yet
 * (see the contract note in `lib/auth-api.ts`). Until it is implemented this
 * submission will fail; the form degrades gracefully, mapping the error to a
 * localized message (incorrect current password vs. not-implemented vs.
 * generic) rather than throwing.
 */
function Form() {
  const t = useTranslations('profile')
  const router = useRouter()
  const { values, errors, setValue, validate, validateField } = useZodForm<ChangePasswordInput>(
    changePasswordSchema,
    { currentPassword: '', newPassword: '', confirmPassword: '' },
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) return
    setSubmitting(true)
    changePasswordRequest(data.currentPassword, data.newPassword)
      .then(() => {
        toast({ title: t('password.saved'), variant: 'success' })
        router.replace('/profile')
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        setFormError(t(`password.${changePasswordErrorKey(err)}`))
      })
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-4" noValidate>
      <h1 className="font-display text-xl font-bold text-foreground">{t('password.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('password.desc')}</p>

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{t('password.current')}</Label>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => setValue('currentPassword', e.target.value)}
          onBlur={() => validateField('currentPassword')}
          aria-invalid={Boolean(errors.currentPassword)}
          aria-describedby={errors.currentPassword ? 'currentPassword-error' : undefined}
        />
        {errors.currentPassword ? (
          <p id="currentPassword-error" className="text-sm text-destructive">
            {errors.currentPassword}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t('password.new')}</Label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => setValue('newPassword', e.target.value)}
          onBlur={() => validateField('newPassword')}
          aria-invalid={Boolean(errors.newPassword)}
          aria-describedby="newPassword-strength"
        />
        <PasswordStrength password={values.newPassword} id="newPassword-strength" />
        {errors.newPassword ? (
          <p className="text-sm text-destructive">{errors.newPassword}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{t('password.confirm')}</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => setValue('confirmPassword', e.target.value)}
          onBlur={() => validateField('confirmPassword')}
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
        />
        {errors.confirmPassword ? (
          <p id="confirmPassword-error" className="text-sm text-destructive">
            {errors.confirmPassword}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.replace('/profile')}
        >
          {t('password.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? (
            <Spinner size="sm" className="text-primary-foreground" />
          ) : (
            t('password.save')
          )}
        </Button>
      </div>
    </form>
  )
}

export function ChangePasswordForm() {
  return (
    <BookingShell>
      <Form />
    </BookingShell>
  )
}
