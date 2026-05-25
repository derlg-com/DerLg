import { describe, it, expect, beforeEach } from 'vitest'
import { useLanguageStore, useTranslations, languageStoreToWsLang } from '@/lib/i18n'
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
    expect(languageStoreToWsLang('km')).toBe('KH')
  })
})
