'use client'

import { Mail, Phone, User } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { useTranslations } from '@/lib/i18n'

/**
 * Guide contact details surfaced after a confirmed guide booking
 * (Section 24.5 — Requirement 38.9).
 *
 * Backend contract (assumed — endpoint may not yet exist):
 *   GET /v1/bookings/{id}/guide-contact
 *   response envelope data: { name, phone?, email?, profilePicture? }
 *
 * Degrades gracefully: while loading or when the endpoint is missing / errors /
 * returns nothing, the card renders nothing rather than crashing the
 * confirmation page. It is only mounted for guide-type bookings.
 */
export interface GuideContact {
  name: string
  phone?: string | null
  email?: string | null
  profilePicture?: string | null
}

export function GuideContactCard({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout')
  const { data, error } = useApiQuery<GuideContact>(`/v1/bookings/${bookingId}/guide-contact`, {
    // The endpoint may not be deployed yet; don't retry a missing route.
    retry: 0,
  })

  // No contact info available yet (loading, missing endpoint, or empty) — stay
  // silent so the confirmation page is never blocked.
  if (error || !data || (!data.phone && !data.email)) {
    return null
  }

  return (
    <Card variant="elevated">
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-foreground">{t('guideContact.title')}</h2>
        <div className="flex items-center gap-3">
          <Avatar src={data.profilePicture ?? undefined} name={data.name} size="md" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-medium text-foreground">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              {data.name}
            </p>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {data.phone ? (
            <li>
              <a
                href={`tel:${data.phone}`}
                className="flex items-center gap-2 text-foreground hover:text-primary"
              >
                <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
                {data.phone}
              </a>
            </li>
          ) : null}
          {data.email ? (
            <li>
              <a
                href={`mailto:${data.email}`}
                className="flex items-center gap-2 text-foreground hover:text-primary"
              >
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
                {data.email}
              </a>
            </li>
          ) : null}
        </ul>
        <p className="text-xs text-muted-foreground">{t('guideContact.note')}</p>
      </CardContent>
    </Card>
  )
}
