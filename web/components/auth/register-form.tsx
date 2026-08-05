'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm, useWatch } from 'react-hook-form'

import { Button, Card, Field, Input } from '@/components/ui'
import { authErrorKey, useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/cn'
import { useRouter } from '@/lib/i18n/navigation'
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
            'h-1 flex-1 rounded-full',
            score >= step
              ? score <= 2
                ? 'bg-[var(--color-warning-500)]'
                : 'bg-[var(--color-success-500)]'
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

  // useWatch subscribes to a single field, rather than re-rendering the whole form
  // the way the returned watch() function does.
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
    <Card className="space-y-5 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('signUp.title')}</h1>

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
            />
          )}
        </Field>

        <Field label={t('fields.name')}>
          {(props) => <Input {...props} {...register('name')} autoComplete="name" />}
        </Field>

        <Field label={t('fields.phone')}>
          {(props) => (
            <Input {...props} {...register('phone')} type="tel" autoComplete="tel" inputMode="tel" />
          )}
        </Field>

        {registerUser.isError ? (
          <p role="alert" className="text-sm text-[var(--text-danger)]">
            {t(`errors.${authErrorKey(registerUser.error)}` as 'errors.emailExists')}
          </p>
        ) : null}

        <Button type="submit" block loading={isSubmitting || registerUser.isPending}>
          {t('signUp.submit')}
        </Button>
      </form>

      <p className="text-sm text-[var(--text-secondary)]">
        {t('signUp.haveAccount')}{' '}
        <a href="./login" className="font-medium text-[var(--accent)] hover:underline">
          {t('signUp.cta')}
        </a>
      </p>
    </Card>
  )
}
