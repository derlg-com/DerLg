'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, SearchX } from 'lucide-react'
import { useRequireAuth } from '@/hooks/use-auth'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations } from '@/lib/i18n'

/** Auth gate for booking pages: shows a spinner until rehydrated, then guards. */
export function BookingShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, rehydrated } = useRequireAuth()
  if (!rehydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }
  if (!isAuthenticated) return null
  return <>{children}</>
}

export function BookingSummary({
  name,
  imageUrl,
  subtitle,
  priceLabel,
}: {
  name: string
  imageUrl: string | null
  subtitle?: string | null
  priceLabel?: string
}) {
  return (
    <Card variant="elevated" className="flex items-center gap-3 p-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-display font-semibold text-foreground">{name}</p>
        {subtitle ? <p className="line-clamp-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        {priceLabel ? <p className="text-sm font-semibold text-foreground">{priceLabel}</p> : null}
      </div>
    </Card>
  )
}

/**
 * Shown when the resource being booked can't be loaded (e.g. an invalid or
 * stale id returns 404). Offers a clear way back rather than presenting a
 * booking form for something that doesn't exist.
 */
export function BookingNotFound({ backHref }: { backHref?: string }) {
  const t = useTranslations('bookings')
  const router = useRouter()
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <EmptyState
        icon={SearchX}
        title={t('form.notFoundTitle')}
        description={t('form.notFoundDesc')}
        action={
          backHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={backHref}>{t('form.back')}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              {t('form.back')}
            </Button>
          )
        }
      />
    </div>
  )
}
