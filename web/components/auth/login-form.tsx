'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'

import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Button, Card, Field, Input } from '@/components/ui'
import { authErrorKey, useAuth } from '@/hooks/use-auth'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { loginSchema, type LoginFormValues } from '@/schemas/auth'

export function LoginForm({ next }: { next?: string } = {}) {
  const t = useTranslations('account')
  const { login } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    await login.mutateAsync(values)
    const target = next && next.startsWith('/') ? next : '/'
    router.replace(target)
  }

  return (
    <Card className="space-y-6 rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-6 sm:p-8 shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="size-2 rounded-full bg-[var(--color-navel-jade)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-navel-jade)]">
            DerLg Account
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('signIn.title')}
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Welcome back! Sign in to continue your travel journey.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field
          label={t('fields.email')}
          required
          error={errors.email ? t('fields.email') : undefined}
        >
          {(props) => (
            <Input
              {...props}
              {...register('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              data-autofocus
              className="rounded-2xl bg-[var(--color-navel-cream)]/40 dark:bg-[var(--surface)] py-3 text-sm border-[var(--border-subtle)] focus:border-[var(--color-navel-jade)] focus:ring-[var(--color-navel-jade)]/20"
            />
          )}
        </Field>

        <Field
          label={t('fields.password')}
          required
          error={errors.password ? t('fields.password') : undefined}
        >
          {(props) => (
            <Input
              {...props}
              {...register('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-2xl bg-[var(--color-navel-cream)]/40 dark:bg-[var(--surface)] py-3 text-sm border-[var(--border-subtle)] focus:border-[var(--color-navel-jade)] focus:ring-[var(--color-navel-jade)]/20"
            />
          )}
        </Field>

        {login.isError ? (
          <div className="rounded-xl bg-[var(--tone-danger-bg)] p-3 text-xs text-[var(--tone-danger-text)] border border-[var(--tone-danger-border,#f87171)]/30" role="alert">
            {t(`errors.${authErrorKey(login.error)}` as 'errors.invalidCredentials')}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="navelPrimary"
          size="xl"
          className="w-full rounded-full py-4 text-base font-semibold shadow-md shadow-[#1B3232]/20"
          loading={isSubmitting || login.isPending}
        >
          <span>{t('signIn.submit')}</span>
          <ArrowRight className="size-4 ml-1.5" />
        </Button>
      </form>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--border-subtle)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--surface)] dark:bg-[var(--surface-sunken)] px-3 text-[var(--text-tertiary)] font-medium">
            {t('or')}
          </span>
        </div>
      </div>

      <GoogleSignInButton next={next} />

      <p className="text-center text-xs text-[var(--text-secondary)] pt-2">
        {t('signIn.noAccount')}{' '}
        <Link href="/register" className="font-bold text-[var(--color-navel-jade)] hover:underline">
          {t('signIn.cta')}
        </Link>
      </p>
    </Card>
  )
}
