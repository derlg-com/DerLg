import { describe, it, expect } from 'vitest'
import en from '@/messages/en.json'
import zh from '@/messages/zh.json'
import km from '@/messages/km.json'

function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [prefix]
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    out.push(...keyPaths(v, path))
  }
  return out
}

const enKeys = new Set(keyPaths(en))
const zhKeys = new Set(keyPaths(zh))
const kmKeys = new Set(keyPaths(km))

function diff(a: Set<string>, b: Set<string>) {
  return {
    missing: [...a].filter((k) => !b.has(k)).sort(),
    extra: [...b].filter((k) => !a.has(k)).sort(),
  }
}

describe('i18n key parity', () => {
  it('zh matches en', () => {
    expect(diff(enKeys, zhKeys)).toEqual({ missing: [], extra: [] })
  })

  it('km matches en', () => {
    expect(diff(enKeys, kmKeys)).toEqual({ missing: [], extra: [] })
  })

  it('includes every required manual-app namespace', () => {
    for (const ns of [
      'common',
      'shell',
      'account',
      'trips',
      'hotels',
      'transportation',
      'guides',
      'bookings',
      'checkout',
      'profile',
      'search',
    ]) {
      expect(en).toHaveProperty(ns)
      expect(zh).toHaveProperty(ns)
      expect(km).toHaveProperty(ns)
    }
  })
})
