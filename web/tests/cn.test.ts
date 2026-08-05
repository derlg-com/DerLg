import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/cn'

describe('cn', () => {
  it('merges plain class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('lets later classes win on a Tailwind conflict', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values', () => {
    expect(cn('px-2', false, undefined, null, '')).toBe('px-2')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})
