'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm, useWatch } from 'react-hook-form'

import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Button, Card, Field, Input } from '@/components/ui'
import { authErrorKey, useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/cn'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { passwordStrength, registerSchema, type RegisterFormValues } from '@/schemas/auth'

/** Visual strength signal. Purely advisory; the real rule is the 8-char minimum. */
function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrength(password)
  if (password === '') return null

  return (
    <div className="flex gap-1" aria-hidden="true">
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            score >= step
              ? score <= 2
                ? 'bg-[var(--color-navel-gold)]'
                : 'bg-[var(--color-navel-jade)]'
              : 'bg-[var(--border-subtle)]',
          )}
        />
      ))}
    </div>
  )
}

export function RegisterForm() {
  const t = useTranslations('account')
  const { register: registerUser } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  const password = useWatch({ control, name: 'password' }) ?? ''

  async function onSubmit(values: RegisterFormValues) {
    await registerUser.mutateAsync({
      email: values.email,
      password: values.password,
      name: values.name?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
    })
    router.replace('/')
  }

  return (
    <Card className="space-y-6 rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-6 sm:p-8 shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="size-2 rounded-full bg-[var(--color-navel-jade)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-navel-jade)]">
            Create Account
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('signUp.title')}
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Join DerLg to explore Cambodia with local insights and seamless bookings.
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

        <div className="space-y-2">
          <Field
            label={t('fields.password')}
            required
            description={t('fields.password')}
            error={errors.password ? t('fields.password') : undefined}
          >
            {(props) => (
              <Input
                {...props}
                {...register('password')}
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                className="rounded-2xl bg-[var(--color-navel-cream)]/40 dark:bg-[var(--surface)] py-3 text-sm border-[var(--border-subtle)] focus:border-[var(--color-navel-jade)] focus:ring-[var(--color-navel-jade)]/20"
              />
            )}
          </Field>
          <StrengthMeter password={password} />
        </div>

        <Field
          label={t('fields.confirmPassword')}
          required
          error={errors.confirmPassword ? t('fields.confirmPassword') : undefined}
        >
          {(props) => (
            <Input
              {...props}
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              className="rounded-2xl bg-[var(--color-navel-cream)]/40 dark:bg-[var(--surface)] py-3 text-sm border-[var(--border-subtle)] focus:border-[var(--color-navel-jade)] focus:ring-[var(--color-navel-jade)]/20"
            />
          )}
        </Field>

        <Field label={t('fields.name')}>
          {(props) => (
            <Input
              {...props}
              {...register('name')}
              autoComplete="name"
              placeholder="Full name"
              className="rounded-2xl bg-[var(--color-navel-cream)]/40 dark:bg-[var(--surface)] py-3 text-sm border-[var(--border-subtle)] focus:border-[var(--color-navel-jade)] focus:ring-[var(--color-navel-jade)]/20"
            />
          )}
        </Field>

        <Field label={t('fields.phone')}>
          {(props) => (
            <Input
              {...props}
              {...register('phone')}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+855 12 345 678"
              className="rounded-2xl bg-[var(--color-navel-cream)]/40 dark:bg-[var(--surface)] py-3 text-sm border-[var(--border-subtle)] focus:border-[var(--color-navel-jade)] focus:ring-[var(--color-navel-jade)]/20"
            />
          )}
        </Field>

        {registerUser.isError ? (
          <div className="rounded-xl bg-[var(--tone-danger-bg)] p-3 text-xs text-[var(--tone-danger-text)] border border-[var(--tone-danger-border,#f87171)]/30" role="alert">
            {t(`errors.${authErrorKey(registerUser.error)}` as 'errors.emailExists')}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="navelPrimary"
          size="xl"
          className="w-full rounded-full py-4 text-base font-semibold shadow-md shadow-[#1B3232]/20"
          loading={isSubmitting || registerUser.isPending}
        >
          <span>{t('signUp.submit')}</span>
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

      <GoogleSignInButton />

      <p className="text-center text-xs text-[var(--text-secondary)] pt-2">
        {t('signUp.haveAccount')}{' '}
        <Link href="/login" className="font-bold text-[var(--color-navel-jade)] hover:underline">
          {t('signUp.cta')}
        </Link>
      </p>
    </Card>
  )
}
