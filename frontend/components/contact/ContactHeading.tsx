'use client'

import { useTranslations } from '@/lib/i18n'

/**
 * Client heading components for the Contact page. Kept separate so the page
 * itself stays a server component (it only renders metadata + layout), while
 * the translated, single `h1` and the form section `h2` live here
 * (Task 30.5 — heading hierarchy: exactly one h1 per page).
 */
export function ContactHeading() {
  const t = useTranslations('contact')
  return (
    <header className="space-y-1">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {t('title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
    </header>
  )
}

export function ContactFormHeading() {
  const t = useTranslations('contact')
  return (
    <h2 id="contact-form-heading" className="font-display text-base font-semibold text-foreground">
      {t('form.title')}
    </h2>
  )
}
