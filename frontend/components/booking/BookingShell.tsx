'use client'

import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { useRequireAuth } from '@/hooks/use-auth'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'

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
    <Card className="flex items-center gap-3 p-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-medium text-foreground">{name}</p>
        {subtitle ? <p className="line-clamp-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        {priceLabel ? <p className="text-sm font-semibold text-foreground">{priceLabel}</p> : null}
      </div>
    </Card>
  )
}
