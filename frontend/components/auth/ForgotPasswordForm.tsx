'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useZodForm } from '@/lib/use-zod-form'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas/auth'
import { forgotPasswordRequest } from '@/lib/auth-api'
import { useTranslations } from '@/lib/i18n'

export function ForgotPasswordForm() {
  const t = useTranslations('account')
  const { values, errors, setValue, validate } = useZodForm<ForgotPasswordInput>(
    forgotPasswordSchema,
    { email: '' },
  )
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = validate()
    if (!data) return
    setSubmitting(true)
    // Always resolve to the success UI to avoid email enumeration.
    forgotPasswordRequest(data.email)
      .catch(() => undefined)
      .finally(() => {
        setSubmitting(false)
        setSent(true)
      })
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-success" aria-hidden />
        <p className="text-sm text-muted-foreground">{t('forgot.sent')}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t('forgot.back')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">{t('forgot.desc')}</p>
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
      <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('forgot.submit')}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          {t('forgot.back')}
        </Link>
      </p>
    </form>
  )
}
