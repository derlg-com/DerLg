import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { locales, type Locale } from '@/lib/i18n/config'

function messagesFor(locale: Locale) {
  return JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'))
}

function Headline() {
  const t = useTranslations('brand')
  return <h1>{t('headline')}</h1>
}

function CommonActions() {
  const t = useTranslations('common')
  return (
    <div>
      <button type="button">{t('confirm')}</button>
      <button type="button">{t('cancel')}</button>
    </div>
  )
}

describe('translation rendering', () => {
  it('renders the brand headline in every locale, each with distinct text', () => {
    const rendered = new Map<Locale, string>()

    for (const locale of locales) {
      const { unmount } = render(
        <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
          <Headline />
        </NextIntlClientProvider>,
      )
      const text = screen.getByRole('heading', { level: 1 }).textContent ?? ''
      expect(text.trim()).not.toBe('')
      // A missing key would render the fallback marker instead of a translation.
      expect(text).not.toContain('⚠️')
      rendered.set(locale, text)
      unmount()
    }

    // Three genuinely different translations, not the English string three times.
    expect(new Set(rendered.values()).size).toBe(3)
  })

  it('renders Khmer script for the km locale', () => {
    render(
      <NextIntlClientProvider locale="km" messages={messagesFor('km')}>
        <CommonActions />
      </NextIntlClientProvider>,
    )
    const confirm = screen.getAllByRole('button')[0]!.textContent ?? ''
    // Khmer Unicode block U+1780–U+17FF.
    expect(confirm).toMatch(/[\u1780-\u17ff]/)
  })

  it('renders Han script for the zh locale', () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messagesFor('zh')}>
        <CommonActions />
      </NextIntlClientProvider>,
    )
    const confirm = screen.getAllByRole('button')[0]!.textContent ?? ''
    // CJK unified ideographs U+4E00–U+9FFF.
    expect(confirm).toMatch(/[\u4e00-\u9fff]/)
  })
})
