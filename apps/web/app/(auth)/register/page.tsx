import type { Metadata } from 'next';

import { RegisterForm } from '@/components/auth/RegisterForm';
import { translate } from '@/lib/i18n';

export const metadata: Metadata = {
  title: translate('auth.signUpTitle'),
  description: translate('auth.signUpBody'),
};

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">{translate('auth.signUpTitle')}</h1>
        <p className="text-sm text-ink-600">{translate('auth.signUpBody')}</p>
      </div>
      <RegisterForm />
    </div>
  );
}
