import { describe, it, expect } from 'vitest'
import { changePasswordSchema } from '@/schemas/auth'
import { changePasswordErrorKey } from '@/lib/change-password-error'
import { ApiError } from '@/lib/api-client'

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'oldpass1',
    newPassword: 'newpass12',
    confirmPassword: 'newpass12',
  }

  it('accepts a valid change with all rules satisfied', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true)
  })

  it('requires the current password (Requirement 8.5)', () => {
    const result = changePasswordSchema.safeParse({ ...valid, currentPassword: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'currentPassword')).toBe(true)
    }
  })

  it('enforces minimum length on the new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass1',
      newPassword: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'newPassword')).toBe(true)
    }
  })

  it('requires the confirmation to match the new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass1',
      newPassword: 'newpass12',
      confirmPassword: 'newpass13',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true)
    }
  })

  it('rejects a new password identical to the current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'samepass1',
      newPassword: 'samepass1',
      confirmPassword: 'samepass1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'newPassword')).toBe(true)
    }
  })
})

describe('changePasswordErrorKey', () => {
  function apiError(status: number) {
    return new ApiError({ code: `HTTP_${status}`, message: 'x', status })
  }

  it('maps 401 to incorrect current password', () => {
    expect(changePasswordErrorKey(apiError(401))).toBe('errors.incorrectCurrent')
  })

  it('maps 400 to incorrect current password', () => {
    expect(changePasswordErrorKey(apiError(400))).toBe('errors.incorrectCurrent')
  })

  it('maps 404 to not-implemented (endpoint missing on backend)', () => {
    expect(changePasswordErrorKey(apiError(404))).toBe('errors.notImplemented')
  })

  it('maps other API errors to generic', () => {
    expect(changePasswordErrorKey(apiError(500))).toBe('errors.generic')
  })

  it('maps non-API errors to generic', () => {
    expect(changePasswordErrorKey(new Error('network'))).toBe('errors.generic')
    expect(changePasswordErrorKey(undefined)).toBe('errors.generic')
  })
})
