import { describe, it, expect } from 'vitest'
import { encodeQrMatrix, qrMatrixToSvg } from '@/lib/qr-code'

describe('encodeQrMatrix', () => {
  it('produces a square boolean matrix', () => {
    const m = encodeQrMatrix('https://derlg.com/bookings/ABC123')
    expect(m.length).toBeGreaterThan(0)
    expect(m.every((row) => row.length === m.length)).toBe(true)
    expect(m.flat().every((cell) => typeof cell === 'boolean')).toBe(true)
  })

  it('places finder patterns in three corners (dark top-left module)', () => {
    const m = encodeQrMatrix('test')
    // Finder pattern outer ring corner is dark.
    expect(m[0][0]).toBe(true)
    expect(m[0][m.length - 1]).toBe(true)
    expect(m[m.length - 1][0]).toBe(true)
  })

  it('selects a larger version for longer payloads', () => {
    const small = encodeQrMatrix('hi')
    const large = encodeQrMatrix('x'.repeat(120))
    expect(large.length).toBeGreaterThan(small.length)
  })

  it('throws when payload exceeds supported capacity', () => {
    expect(() => encodeQrMatrix('y'.repeat(5000))).toThrow()
  })
})

describe('qrMatrixToSvg', () => {
  it('renders an svg string with the expected viewBox accounting for margin', () => {
    const m = encodeQrMatrix('test')
    const svg = qrMatrixToSvg(m, { margin: 4 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain(`viewBox="0 0 ${m.length + 8} ${m.length + 8}"`)
    expect(svg).toContain('<path')
  })
})
