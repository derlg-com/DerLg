'use client'

import { useRouter } from 'next/navigation'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { useZodForm } from '@/lib/use-zod-form'
import { useUpdateProfile } from '@/hooks/use-update-profile'
import { updateProfileSchema, type UpdateProfileValues } from '@/schemas/profile'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarUpload } from '@/components/profile/AvatarUpload'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useTranslations } from '@/lib/i18n'
import type { UserProfile } from '@/types/api'

function Form({ user }: { user: UserProfile }) {
  const t = useTranslations('profile')
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const { values, errors, setValue, validate, validateField } = useZodForm<UpdateProfileValues>(
    updateProfileSchema,
    {
      name: user.name ?? '',
      phone: user.phone ?? '',
      avatarUrl: user.avatarUrl ?? '',
    },
  )
  const { mutate, isPending } = useUpdateProfile()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = validate()
    if (!data) return
    mutate(data)
      .then((updated) => {
        setUser({ id: updated.id, email: updated.email, name: updated.name, role: updated.role })
        toast({ title: t('edit.saved'), variant: 'success' })
        router.replace('/profile')
      })
      .catch(() => {
        toast({ title: t('edit.error'), variant: 'error' })
      })
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-4" noValidate>
      <h1 className="text-xl font-bold text-foreground">{t('edit.title')}</h1>
      <div className="space-y-3">
        <Label>{t('edit.avatar')}</Label>
        <AvatarUpload
          value={values.avatarUrl || null}
          name={values.name}
          onUploaded={(url) => setValue('avatarUrl', url)}
        />
        <div className="space-y-1.5">
          <Label htmlFor="avatarUrl">{t('edit.avatarUrl')}</Label>
          <Input
            id="avatarUrl"
            value={values.avatarUrl ?? ''}
            onChange={(e) => setValue('avatarUrl', e.target.value)}
            onBlur={() => validateField('avatarUrl')}
            placeholder="https://…"
            aria-invalid={Boolean(errors.avatarUrl)}
            aria-describedby={errors.avatarUrl ? 'avatarUrl-error' : undefined}
          />
          {errors.avatarUrl ? (
            <p id="avatarUrl-error" className="text-sm text-destructive">
              {errors.avatarUrl}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('edit.email')}</Label>
        <Input id="email" value={user.email} readOnly disabled aria-describedby="email-hint" />
        <p id="email-hint" className="text-sm text-muted-foreground">
          {t('edit.emailHint')}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">{t('edit.name')}</Label>
        <Input
          id="name"
          value={values.name ?? ''}
          onChange={(e) => setValue('name', e.target.value)}
          onBlur={() => validateField('name')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name ? (
          <p id="name-error" className="text-sm text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('edit.phone')}</Label>
        <Input
          id="phone"
          type="tel"
          value={values.phone ?? ''}
          onChange={(e) => setValue('phone', e.target.value)}
          onBlur={() => validateField('phone')}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone ? (
          <p id="phone-error" className="text-sm text-destructive">
            {errors.phone}
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
          {t('edit.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? <Spinner size="sm" className="text-primary-foreground" /> : t('edit.save')}
        </Button>
      </div>
    </form>
  )
}

function Inner() {
  const { data: user, isLoading } = useApiQuery<UserProfile>('/v1/users/me')
  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  return <Form user={user} />
}

export function EditProfileForm() {
  return (
    <BookingShell>
      <Inner />
    </BookingShell>
  )
}
