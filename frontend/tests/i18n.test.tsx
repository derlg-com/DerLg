import { describe, it, expect, beforeEach } from 'vitest'
import {
  useLanguageStore,
  useTranslations,
  languageStoreToWsLang,
  resolveBrowserLocale,
  initBrowserLocaleDefault,
  LANGUAGE_STORAGE_KEY,
} from '@/lib/i18n'
import { renderHook } from '@testing-library/react'

describe('lib/i18n', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: 'en' })
  })

  it('returns english strings by default', () => {
    const { result } = renderHook(() => useTranslations())
    expect(result.current('common.send')).toBe('Send')
  })

  it('falls back to english for missing keys in other locales', () => {
    useLanguageStore.setState({ locale: 'km' })
    const { result } = renderHook(() => useTranslations())
    expect(result.current('common.send')).toBe('ផ្ញើ')
    expect(result.current('does.not.exist')).toBe('does.not.exist')
  })

  it('interpolates variables in templates', () => {
    const { result } = renderHook(() => useTranslations())
    expect(result.current('booking.expiresIn', { minutes: 3, seconds: '05' })).toContain('3m')
  })

  it('maps locale → WS language code', () => {
    expect(languageStoreToWsLang('en')).toBe('EN')
    expect(languageStoreToWsLang('zh')).toBe('ZH')
    expect(languageStoreToWsLang('km')).toBe('KM')
  })
})

describe('lib/i18n browser-language detection (Req 13.3)', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: 'en' })
    window.localStorage.clear()
  })

  it('maps supported browser tags to a locale', () => {
    expect(resolveBrowserLocale(['zh-CN'])).toBe('zh')
    expect(resolveBrowserLocale(['km'])).toBe('km')
    expect(resolveBrowserLocale(['en-US'])).toBe('en')
  })

  it('picks the first supported tag and ignores unsupported ones', () => {
    expect(resolveBrowserLocale(['fr-FR', 'ja', 'zh-TW', 'en'])).toBe('zh')
  })

  it('falls back to the default for unsupported / missing languages', () => {
    expect(resolveBrowserLocale(['fr-FR', 'ja'])).toBe('en')
    expect(resolveBrowserLocale(undefined)).toBe('en')
    expect(resolveBrowserLocale([])).toBe('en')
  })

  it('seeds the store from the browser language on first visit', () => {
    Object.defineProperty(navigator, 'languages', { value: ['zh-CN', 'en'], configurable: true })
    const result = initBrowserLocaleDefault()
    expect(result).toBe('zh')
    expect(useLanguageStore.getState().locale).toBe('zh')
  })

  it('does not override a persisted choice (Req 13.5 wins over 13.3)', () => {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      JSON.stringify({ state: { locale: 'km' }, version: 0 }),
    )
    useLanguageStore.setState({ locale: 'km' })
    Object.defineProperty(navigator, 'languages', { value: ['zh-CN'], configurable: true })
    const result = initBrowserLocaleDefault()
    expect(result).toBe('km')
    expect(useLanguageStore.getState().locale).toBe('km')
  })
})
