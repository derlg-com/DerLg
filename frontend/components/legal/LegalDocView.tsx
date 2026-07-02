'use client'

import { useTranslations } from '@/lib/i18n'
import { LEGAL_SECTIONS, type LegalDoc } from '@/lib/legal'

/**
 * Renders a legal document (Terms / Privacy / Cookies) from its i18n section
 * keys (Section 32.1). Uses a single `h1` for the document title followed by
 * `h2` section headings for a correct heading hierarchy. All copy is i18n-driven
 * (`legal.<doc>.*`) so EN/ZH/KM stay in parity.
 */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const t = useTranslations('legal')
  const sections = LEGAL_SECTIONS[doc]

  return (
    <article className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {t(`${doc}.title`)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('lastUpdated')}</p>
      </header>

      <div className="space-y-6">
        {sections.map((key) => (
          <section key={key} aria-labelledby={`${doc}-${key}`}>
            <h2 id={`${doc}-${key}`} className="font-display text-lg font-semibold text-foreground">
              {t(`${doc}.sections.${key}.heading`)}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {t(`${doc}.sections.${key}.body`)}
            </p>
          </section>
        ))}
      </div>
    </article>
  )
}
