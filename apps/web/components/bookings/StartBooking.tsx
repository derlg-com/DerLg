'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useCreateBooking } from '@/hooks/use-bookings';
import { useDraft } from '@/hooks/use-journey-draft';
import { useCurrentUser } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';
import { translateFieldError, useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';

const contactSchema = z.object({
  contactName: z.string().trim().min(2, 'validation.nameTooShort').max(120),
  contactEmail: z.string().trim().email('validation.emailInvalid').max(254),
});

type ContactInput = z.infer<typeof contactSchema>;

/**
 * Turns a draft into a 15-minute hold. The amount is displayed from the draft
 * but never sent: the API prices the itinerary itself.
 */
export function StartBooking({ draftId }: { draftId: string }) {
  const t = useTranslations('bookings');
  const router = useRouter();
  const { user } = useCurrentUser();
  const draft = useDraft(draftId);
  const createBooking = useCreateBooking();

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    values: {
      contactName: user?.fullName ?? '',
      contactEmail: user?.email ?? '',
    },
  });

  const submissionError =
    createBooking.error instanceof ApiError
      ? t('createError', { message: createBooking.error.message })
      : createBooking.error
        ? t('createError', { message: '' })
        : null;

  if (draft.isLoading) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('holding')}
      </p>
    );
  }

  if (!draft.data) {
    return (
      <p className="px-6 py-16 text-center text-ink-700" role="alert">
        {t('notFound')}
      </p>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">{t('startBooking')}</h1>
        <p className="text-sm text-ink-600">{t('startBookingBody')}</p>
      </header>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink-200 bg-white p-5">
        <p className="font-medium text-ink-900">{draft.data.title}</p>
        <p className="text-sm text-ink-600">
          {draft.data.startDate ?? '—'} · {t('guests', { count: draft.data.guests })}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-ink-900">
          {formatCents(draft.data.price.totalCents)}
        </p>
      </section>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          createBooking.mutate(
            { draftId, ...values },
            { onSuccess: (booking) => router.push(`/bookings/${booking.id}`) },
          ),
        )}
      >
        <TextField
          label={t('contactNameLabel')}
          autoComplete="name"
          error={translateFieldError(form.formState.errors.contactName?.message)}
          {...form.register('contactName')}
        />
        <TextField
          label={t('contactEmailLabel')}
          type="email"
          autoComplete="email"
          error={translateFieldError(form.formState.errors.contactEmail?.message)}
          {...form.register('contactEmail')}
        />

        {submissionError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {submissionError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={createBooking.isPending}>
          {createBooking.isPending ? t('holding') : t('startBooking')}
        </Button>
      </form>
    </main>
  );
}
