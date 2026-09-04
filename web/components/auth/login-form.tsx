'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'

import { Button, Card, Field, Input } from '@/components/ui'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { authErrorKey, useAuth } from '@/hooks/use-auth'
import { useRouter } from '@/lib/i18n/navigation'
import { loginSchema, type LoginFormValues } from '@/schemas/auth'

export function LoginForm() {
  const t = useTranslations('account')
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    await login.mutateAsync(values)
    // Return the user where they were headed, defaulting to home.
    const next = searchParams.get('next')
    router.replace(next && next.startsWith('/') ? next : '/')
  }

  return (
    <Card className="space-y-5 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('signIn.title')}</h1>

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
              data-autofocus
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
            />
          )}
        </Field>

        {login.isError ? (
          <p role="alert" className="text-sm text-[var(--text-danger)]">
            {t(`errors.${authErrorKey(login.error)}` as 'errors.invalidCredentials')}
          </p>
        ) : null}

        <Button type="submit" block loading={isSubmitting || login.isPending}>
          {t('signIn.submit')}
        </Button>
      </form>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--border-subtle)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--surface)] px-2 text-[var(--text-tertiary)]">
            {t('or')}
          </span>
        </div>
      </div>

      <GoogleSignInButton next={searchParams.get('next') ?? undefined} />

      <p className="text-sm text-[var(--text-secondary)]">
        {t('signIn.noAccount')}{' '}
        <a href="./register" className="font-medium text-[var(--accent)] hover:underline">
          {t('signIn.cta')}
        </a>
      </p>
    </Card>
  )
}
