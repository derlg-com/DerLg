import { describe, it, expect } from 'vitest'
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  VERIFICATION_STATUSES,
  validateDocumentFile,
  parseVerificationStatus,
  deriveStatusFromProfile,
} from '@/lib/student-verification'

/** Build a File of an exact byte length with the given MIME type. */
function fileOfSize(bytes: number, type: string, name = 'student-id'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('validateDocumentFile (Req 35.3 — type/size)', () => {
  it.each(ALLOWED_DOCUMENT_TYPES)('accepts a valid %s under the size limit', (type) => {
    expect(validateDocumentFile(fileOfSize(1024, type))).toEqual({ ok: true })
  })

  it('allows PDF documents (not just images)', () => {
    expect(validateDocumentFile(fileOfSize(2048, 'application/pdf')).ok).toBe(true)
  })

  it('accepts a file exactly at the 10 MB boundary', () => {
    expect(validateDocumentFile(fileOfSize(MAX_DOCUMENT_BYTES, 'application/pdf')).ok).toBe(true)
  })

  it('rejects a file one byte over the 10 MB limit', () => {
    expect(validateDocumentFile(fileOfSize(MAX_DOCUMENT_BYTES + 1, 'image/png'))).toEqual({
      ok: false,
      error: 'size',
    })
  })

  it.each(['image/gif', 'image/webp', 'text/plain', 'application/zip', 'image/svg+xml'])(
    'rejects unsupported type %s',
    (type) => {
      expect(validateDocumentFile(fileOfSize(1024, type))).toEqual({ ok: false, error: 'type' })
    },
  )

  it('rejects an empty file', () => {
    expect(validateDocumentFile(fileOfSize(0, 'application/pdf'))).toEqual({
      ok: false,
      error: 'empty',
    })
  })

  it('checks type before size so a huge non-document reports a type error', () => {
    expect(validateDocumentFile(fileOfSize(MAX_DOCUMENT_BYTES + 10, 'application/zip'))).toEqual({
      ok: false,
      error: 'type',
    })
  })

  it('differs from the avatar validator: 10 MB limit, not 5 MB', () => {
    // A 6 MB PDF is rejected by the 5 MB avatar rule but accepted here.
    const sixMb = 6 * 1024 * 1024
    expect(validateDocumentFile(fileOfSize(sixMb, 'application/pdf')).ok).toBe(true)
  })
})

describe('parseVerificationStatus (Req 35.5 — status states)', () => {
  it('exposes exactly the four known statuses', () => {
    expect(VERIFICATION_STATUSES).toEqual(['none', 'pending', 'approved', 'rejected'])
  })

  it.each(VERIFICATION_STATUSES)(
    'reads status %s from the { success, data } envelope',
    (status) => {
      expect(parseVerificationStatus({ success: true, data: { status } }).status).toBe(status)
    },
  )

  it('reads status from a bare body', () => {
    expect(parseVerificationStatus({ status: 'pending' }).status).toBe('pending')
  })

  it('carries through submittedAt, reviewedAt and rejectionReason', () => {
    const result = parseVerificationStatus({
      data: {
        status: 'rejected',
        submittedAt: '2026-05-01T00:00:00.000Z',
        reviewedAt: '2026-05-02T00:00:00.000Z',
        rejectionReason: 'Document expired',
      },
    })
    expect(result).toEqual({
      status: 'rejected',
      submittedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-02T00:00:00.000Z',
      rejectionReason: 'Document expired',
    })
  })

  it('falls back to "none" for unknown or missing status', () => {
    expect(parseVerificationStatus({ status: 'bogus' }).status).toBe('none')
    expect(parseVerificationStatus({}).status).toBe('none')
    expect(parseVerificationStatus(null).status).toBe('none')
    expect(parseVerificationStatus('nope').status).toBe('none')
  })

  it('defaults optional fields to null when absent', () => {
    const result = parseVerificationStatus({ status: 'pending' })
    expect(result.submittedAt).toBeNull()
    expect(result.reviewedAt).toBeNull()
    expect(result.rejectionReason).toBeNull()
  })
})

describe('deriveStatusFromProfile (graceful degradation)', () => {
  it('maps a verified student to "approved"', () => {
    expect(deriveStatusFromProfile(true)).toBe('approved')
  })

  it('maps a non-student (or unknown) to "none"', () => {
    expect(deriveStatusFromProfile(false)).toBe('none')
    expect(deriveStatusFromProfile(undefined)).toBe('none')
  })
})
