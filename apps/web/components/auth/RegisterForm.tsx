'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useRegister } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';
import { translateFieldError, useTranslations } from '@/lib/i18n';
import { type RegisterInput, passwordStrength, registerSchema } from '@/schemas/auth';

export function RegisterForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const t = useTranslations('auth');
  const register = useRegister(redirectTo);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
    mode: 'onBlur',
  });

  // useWatch (rather than form.watch) is safe to memoize under the React compiler.
  const password = useWatch({ control: form.control, name: 'password' }) ?? '';
  const strength = passwordStrength(password);

  const submissionError =
    register.error instanceof ApiError
      ? register.error.fieldErrors[0] ?? register.error.message
      : register.error
        ? t('signUpBody')
        : null;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => register.mutate(values))}
      className="flex w-full flex-col gap-4"
    >
      <TextField
        label={t('fullNameLabel')}
        placeholder={t('fullNamePlaceholder')}
        autoComplete="name"
        error={translateFieldError(form.formState.errors.fullName?.message)}
        {...form.register('fullName')}
      />

      <TextField
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        type="email"
        autoComplete="email"
        error={translateFieldError(form.formState.errors.email?.message)}
        {...form.register('email')}
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          label={t('passwordLabel')}
          placeholder={t('passwordPlaceholder')}
          type="password"
          autoComplete="new-password"
          error={translateFieldError(form.formState.errors.password?.message)}
          {...form.register('password')}
        />
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                data-testid={`strength-bar-${index}`}
                className={`h-1 w-8 rounded-full ${
                  index < strength ? 'bg-brand-600' : 'bg-ink-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-ink-500" data-testid="strength-label">
            {t('strengthLabel')}: {t(`strength${strength}`)}
          </span>
        </div>
      </div>

      {submissionError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {submissionError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={register.isPending}>
        {register.isPending ? t('submittingSignUp') : t('submitSignUp')}
      </Button>

      <p className="text-sm text-ink-600">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-brand-700 underline">
          {t('submitSignIn')}
        </Link>
      </p>
    </form>
  );
}
