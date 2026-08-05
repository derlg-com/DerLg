'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useLogin } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';
import { translateFieldError, useTranslations } from '@/lib/i18n';
import { type LoginInput, loginSchema } from '@/schemas/auth';

export function LoginForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const t = useTranslations('auth');
  const login = useLogin(redirectTo);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const submissionError = login.error instanceof ApiError ? login.error.message : null;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => login.mutate(values))}
      className="flex w-full flex-col gap-4"
    >
      <TextField
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        type="email"
        autoComplete="email"
        error={translateFieldError(form.formState.errors.email?.message)}
        {...form.register('email')}
      />

      <TextField
        label={t('passwordLabel')}
        type="password"
        autoComplete="current-password"
        error={translateFieldError(form.formState.errors.password?.message)}
        {...form.register('password')}
      />

      {submissionError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {submissionError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? t('submittingSignIn') : t('submitSignIn')}
      </Button>

      <p className="text-sm text-ink-600">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-brand-700 underline">
          {t('submitSignUp')}
        </Link>
      </p>
    </form>
  );
}
