'use client'

import Link from 'next/link'
import { Mail, Phone, Clock, MessageCircle } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Accordion, type AccordionItemData } from '@/components/ui/accordion'
import { useTranslations } from '@/lib/i18n'
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  supportMailto,
  supportTel,
  SUPPORT_HOURS_KEYS,
  SUPPORT_FAQ_KEYS,
} from '@/lib/support'

/**
 * Support information panel (Tasks 29.3 + 29.4 — Section 29).
 *
 * Renders the support email, phone, business hours, a FAQ accordion, and a
 * "Live chat / contact support" affordance. The live-chat entry point links to
 * the existing AI concierge page (`/vibe-booking`) rather than embedding a
 * third-party widget.
 *
 * NOTE (Task 29.4): real third-party live chat (e.g. Intercom) is intentionally
 * out of scope here and would be env-gated when introduced. We reuse the
 * in-house AI concierge as the real-time support surface so the affordance
 * always works and degrades gracefully.
 */
export function SupportInfo() {
  const t = useTranslations('contact')

  const faqItems: AccordionItemData[] = SUPPORT_FAQ_KEYS.map((key) => ({
    id: key,
    question: t(`faq.${key}.q`),
    answer: t(`faq.${key}.a`),
  }))

  return (
    <div className="space-y-6">
      {/* Live chat / contact support affordance */}
      <Card variant="elevated" className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t('liveChat.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('liveChat.desc')}</p>
          </div>
        </div>
        <Button asChild variant="gradient" className="w-full">
          <Link href="/vibe-booking">{t('liveChat.cta')}</Link>
        </Button>
      </Card>

      {/* Direct contact details */}
      <Card variant="elevated" className="space-y-4 p-4">
        <h2 className="font-display text-base font-semibold text-foreground">
          {t('support.title')}
        </h2>

        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <span className="block text-xs text-muted-foreground">{t('support.emailLabel')}</span>
              <a href={supportMailto()} className="font-medium text-foreground hover:text-primary">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <span className="block text-xs text-muted-foreground">{t('support.phoneLabel')}</span>
              <a href={supportTel()} className="font-medium text-foreground hover:text-primary">
                {SUPPORT_PHONE}
              </a>
            </div>
          </li>
        </ul>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {t('support.hoursTitle')}
          </div>
          <dl className="space-y-1 pl-6 text-sm text-muted-foreground">
            {SUPPORT_HOURS_KEYS.map((key) => (
              <div key={key} className="flex justify-between gap-4">
                <dt>{t(`support.hours.${key}.label`)}</dt>
                <dd className="text-foreground">{t(`support.hours.${key}.value`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {/* FAQ */}
      <section className="space-y-3" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="font-display text-base font-semibold text-foreground">
          {t('faq.title')}
        </h2>
        <Accordion items={faqItems} aria-label={t('faq.title')} />
      </section>
    </div>
  )
}
