'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { useZodForm } from '@/lib/use-zod-form'
import { updateProfileSchema, type UpdateProfileValues } from '@/schemas/profile'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useTranslations } from '@/lib/i18n'
import type { UserProfile } from '@/types/api'

function Form({ user }: { user: UserProfile }) {
  const t = useTranslations('profile')
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const { values, errors, setValue, validate } = useZodForm<UpdateProfileValues>(updateProfileSchema, {
    name: user.name ?? '',
    phone: user.phone ?? '',
    avatarUrl: user.avatarUrl ?? '',
  })
  const [submitting, setSubmitting] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = validate()
    if (!data) return
    setSubmitting(true)
    api
      .patch<UserProfile>('/v1/users/me', {
        name: data.name || undefined,
        phone: data.phone || undefined,
        avatarUrl: data.avatarUrl || undefined,
      })
      .then((updated) => {
        setUser({ id: updated.id, email: updated.email, name: updated.name, role: updated.role })
        toast({ title: t('edit.saved'), variant: 'success' })
        router.replace('/profile')
      })
      .catch(() => {
        setSubmitting(false)
        toast({ title: t('edit.error'), variant: 'error' })
      })
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-4" noValidate>
      <h1 className="text-xl font-bold text-foreground">{t('edit.title')}</h1>
      <div className="flex items-center gap-3">
        <Avatar src={values.avatarUrl || null} name={values.name} size="lg" />
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="avatarUrl">{t('edit.avatarUrl')}</Label>
          <Input
            id="avatarUrl"
            value={values.avatarUrl ?? ''}
            onChange={(e) => setValue('avatarUrl', e.target.value)}
            placeholder="https://…"
            aria-invalid={Boolean(errors.avatarUrl)}
          />
          {errors.avatarUrl ? <p className="text-sm text-destructive">{errors.avatarUrl}</p> : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('edit.email')}</Label>
        <Input id="email" value={user.email} readOnly disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">{t('edit.name')}</Label>
        <Input id="name" value={values.name ?? ''} onChange={(e) => setValue('name', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('edit.phone')}</Label>
        <Input
          id="phone"
          type="tel"
          value={values.phone ?? ''}
          onChange={(e) => setValue('phone', e.target.value)}
          aria-invalid={Boolean(errors.phone)}
        />
        {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.replace('/profile')}>
          {t('edit.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('edit.save')}
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
