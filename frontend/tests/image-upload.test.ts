import { describe, it, expect } from 'vitest'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  validateImageFile,
  computeCenterSquare,
  parseAvatarUrl,
} from '@/lib/image-upload'

/** Build a File of an exact byte length with the given MIME type. */
function fileOfSize(bytes: number, type: string): File {
  return new File([new Uint8Array(bytes)], 'avatar', { type })
}

describe('validateImageFile (Req 29.2, 29.3)', () => {
  it.each(ALLOWED_IMAGE_TYPES)('accepts a valid %s under the size limit', (type) => {
    const result = validateImageFile(fileOfSize(1024, type))
    expect(result).toEqual({ ok: true })
  })

  it('accepts a file exactly at the 5 MB boundary', () => {
    const result = validateImageFile(fileOfSize(MAX_IMAGE_BYTES, 'image/png'))
    expect(result.ok).toBe(true)
  })

  it('rejects a file one byte over the 5 MB limit', () => {
    const result = validateImageFile(fileOfSize(MAX_IMAGE_BYTES + 1, 'image/jpeg'))
    expect(result).toEqual({ ok: false, error: 'size' })
  })

  it.each(['image/gif', 'application/pdf', 'text/plain', 'image/svg+xml'])(
    'rejects unsupported type %s',
    (type) => {
      const result = validateImageFile(fileOfSize(1024, type))
      expect(result).toEqual({ ok: false, error: 'type' })
    },
  )

  it('rejects an empty file', () => {
    const result = validateImageFile(fileOfSize(0, 'image/png'))
    expect(result).toEqual({ ok: false, error: 'empty' })
  })

  it('checks type before size so a huge non-image reports a type error', () => {
    const result = validateImageFile(fileOfSize(MAX_IMAGE_BYTES + 10, 'application/zip'))
    expect(result).toEqual({ ok: false, error: 'type' })
  })
})

describe('computeCenterSquare (Req 29.4 — center crop geometry)', () => {
  it('returns the full frame for an already-square image', () => {
    expect(computeCenterSquare(500, 500)).toEqual({ sx: 0, sy: 0, size: 500 })
  })

  it('center-crops a landscape image horizontally', () => {
    expect(computeCenterSquare(800, 400)).toEqual({ sx: 200, sy: 0, size: 400 })
  })

  it('center-crops a portrait image vertically', () => {
    expect(computeCenterSquare(400, 800)).toEqual({ sx: 0, sy: 200, size: 400 })
  })

  it('floors odd offsets so the crop stays within bounds', () => {
    const { sx, sy, size } = computeCenterSquare(401, 400)
    expect(size).toBe(400)
    expect(sx).toBe(0)
    expect(sy).toBe(0)
    expect(sx + size).toBeLessThanOrEqual(401)
  })
})

describe('parseAvatarUrl (upload response contract)', () => {
  it('reads avatarUrl from the { success, data } envelope', () => {
    expect(parseAvatarUrl({ success: true, data: { avatarUrl: 'https://x/a.jpg' } })).toBe(
      'https://x/a.jpg',
    )
  })

  it('reads avatarUrl from a bare body', () => {
    expect(parseAvatarUrl({ avatarUrl: 'https://x/b.jpg' })).toBe('https://x/b.jpg')
  })

  it('returns null when no avatarUrl is present', () => {
    expect(parseAvatarUrl({ success: true, data: {} })).toBeNull()
    expect(parseAvatarUrl(null)).toBeNull()
    expect(parseAvatarUrl('nope')).toBeNull()
  })
})
