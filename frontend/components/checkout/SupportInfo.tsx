'use client'

import { Clock, LifeBuoy, Mail, Pencil, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from '@/lib/i18n'
import { SUPPORT_EMAIL, SUPPORT_PHONE, supportMailto, supportTel } from '@/lib/support'

/**
 * Contact and support information for the booking confirmation (Requirement 39.7).
 *
 * Renders how to reach support (email + phone, with service hours) and where to
 * make changes/cancellations. Contact values come from `@/lib/support`
 * (env-overridable); all labels and instruction copy are routed through i18n
 * under `checkout.support.*`.
 *
 * Hidden from the printed/saved confirmation PDF via `print-hidden` so the
 * document stays focused on the booking itself (matches the action chrome).
 */
export function SupportInfo() {
  const t = useTranslations('checkout')

  return (
    <Card data-testid="support-info" className="print-hidden">
      <CardContent className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LifeBuoy className="h-4 w-4 text-primary" aria-hidden />
          {t('support.title')}
        </h2>

        <p className="text-sm text-muted-foreground">{t('support.intro')}</p>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2 text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="text-foreground">{t('support.email')}</span>:{' '}
              <a
                href={supportMailto()}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2 text-muted-foreground">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="text-foreground">{t('support.phone')}</span>:{' '}
              <a
                href={supportTel()}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {SUPPORT_PHONE}
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2 text-muted-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="text-foreground">{t('support.hours')}</span>:{' '}
              {t('support.hoursValue')}
            </span>
          </li>
        </ul>

        {/* Instructions for changes / cancellations (Requirement 39.7). */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{t('support.changes')}</span>
        </div>
      </CardContent>
    </Card>
  )
}
