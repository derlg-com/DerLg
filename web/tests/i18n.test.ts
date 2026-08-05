import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { locales, toAcceptLanguage, toAgentLanguage, localeTags, isLocale } from '@/lib/i18n/config'

type Messages = Record<string, unknown>

function load(locale: string): Messages {
  const path = join(process.cwd(), 'messages', `${locale}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Messages
}

function flatten(value: unknown, prefix = '', out = new Map<string, string>()): Map<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  } else {
    out.set(prefix, String(value))
  }
  return out
}

/** Extracts ICU placeholders such as {count} or {name}. */
function placeholders(message: string): Set<string> {
  return new Set(Array.from(message.matchAll(/\{(\w+)/g), (match) => match[1]!))
}

const catalogues = new Map(locales.map((locale) => [locale, flatten(load(locale))]))

describe('message catalogue parity', () => {
  const english = catalogues.get('en')!

  it('ships a catalogue for every supported locale', () => {
    expect([...catalogues.keys()].sort()).toEqual([...locales].sort())
  })

  it('has a non-trivial number of keys', () => {
    expect(english.size).toBeGreaterThan(500)
  })

  for (const locale of locales.filter((l) => l !== 'en')) {
    it(`${locale} defines every key English defines`, () => {
      const target = catalogues.get(locale)!
      const missing = [...english.keys()].filter((key) => !target.has(key))
      expect(missing).toEqual([])
    })

    it(`${locale} defines no keys English lacks`, () => {
      const target = catalogues.get(locale)!
      const extra = [...target.keys()].filter((key) => !english.has(key))
      expect(extra).toEqual([])
    })

    it(`${locale} has no empty translations`, () => {
      const target = catalogues.get(locale)!
      const empty = [...target.entries()]
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key)
      expect(empty).toEqual([])
    })

    it(`${locale} keeps the same ICU placeholders as English`, () => {
      const target = catalogues.get(locale)!
      const mismatched: string[] = []

      for (const [key, source] of english) {
        const translated = target.get(key)
        if (translated === undefined) continue

        const expected = placeholders(source)
        const actual = placeholders(translated)
        const missing = [...expected].filter((name) => !actual.has(name))
        const surplus = [...actual].filter((name) => !expected.has(name))
        if (missing.length || surplus.length) {
          mismatched.push(`${key}: missing=[${missing}] surplus=[${surplus}]`)
        }
      }

      expect(mismatched).toEqual([])
    })
  }
})

describe('locale configuration', () => {
  it('recognises supported locales only', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('km')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  it('maps every locale to a BCP 47 tag', () => {
    for (const locale of locales) {
      expect(localeTags[locale]).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
    }
  })

  it('builds an Accept-Language header with an English fallback for non-default locales', () => {
    expect(toAcceptLanguage('en')).toBe('en-US')
    expect(toAcceptLanguage('zh')).toBe('zh-CN,en-US;q=0.8')
    expect(toAcceptLanguage('km')).toBe('km-KH,en-US;q=0.8')
  })

  it('maps locales to the agent language codes, using KH for Khmer', () => {
    expect(toAgentLanguage('en')).toBe('EN')
    expect(toAgentLanguage('zh')).toBe('ZH')
    // The agent stores Khmer as KH; KM is only an accepted alias.
    expect(toAgentLanguage('km')).toBe('KH')
  })
})
