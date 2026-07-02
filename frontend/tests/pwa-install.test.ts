import { describe, it, expect, beforeEach } from 'vitest'
import {
  INSTALL_DISMISSED_KEY,
  isInstallDismissed,
  isIos,
  markInstallDismissed,
} from '@/lib/pwa-install'

describe('pwa-install helpers (Req 12.6, 12.7)', () => {
  beforeEach(() => {
    window.localStorage.removeItem(INSTALL_DISMISSED_KEY)
  })

  it('records and reads dismissal', () => {
    expect(isInstallDismissed()).toBe(false)
    markInstallDismissed()
    expect(isInstallDismissed()).toBe(true)
  })

  it('detects iPhone/iPad/iPod user agents', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 5)).toBe(true)
  })

  it('detects iPadOS 13+ masquerading as macOS via touch points', () => {
    const ipadOsUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari'
    expect(isIos(ipadOsUa, 5)).toBe(true)
    // Real desktop Mac (no touch) is NOT iOS.
    expect(isIos(ipadOsUa, 0)).toBe(false)
  })

  it('does not flag Android / desktop Chrome as iOS', () => {
    expect(isIos('Mozilla/5.0 (Linux; Android 14) Chrome/120', 5)).toBe(false)
    expect(isIos('Mozilla/5.0 (Windows NT 10.0) Chrome/120', 0)).toBe(false)
  })
})
