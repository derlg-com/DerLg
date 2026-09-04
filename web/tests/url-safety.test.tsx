import { screen } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { safeHref, safeImageSrc } from '@/lib/url-safety'
import { PayloadBlocks } from '@/components/chat/payloads/block-renderer'
import type { ContentBlock } from '@/lib/vibe/protocol'

import { renderWithProviders } from './helpers/render'

vi.mock('@/lib/i18n/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/map/leaflet-map', () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

/**
 * URL safety for values that arrive from the AI agent.
 *
 * These are security assertions, so they are written adversarially: every entry in
 * the reject list is a payload that would execute script or reach another origin if
 * it got through, and the encodings are the ones that defeat a naive prefix check.
 */

const SCRIPT_URLS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  '  javascript:alert(1)',
  // Browsers strip control characters before parsing the scheme; a prefix
  // comparison alone would not.
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'java\rscript:alert(1)',
  'jav\u0000ascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'blob:https://evil.example/abc',
  'file:///etc/passwd',
]

describe('safeHref', () => {
  it.each(SCRIPT_URLS)('rejects %j', (value) => {
    expect(safeHref(value)).toBeNull()
  })

  it.each([
    '//evil.example/receipt',
    // WHATWG treats a backslash as a slash in path-or-authority state, so these
    // read as paths but resolve to another origin. Refusing all relative input
    // removes the whole category rather than pattern-matching each disguise.
    '/\\evil.example',
    '/\\/evil.example',
    '/\\\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/bookings/abc',
    'bookings/abc',
  ])('rejects the relative or disguised value %j', (value) => {
    expect(safeHref(value)).toBeNull()
  })

  it('rejects non-strings, empty and unparseable values', () => {
    expect(safeHref(undefined)).toBeNull()
    expect(safeHref(null)).toBeNull()
    expect(safeHref(42)).toBeNull()
    expect(safeHref('')).toBeNull()
    expect(safeHref('   ')).toBeNull()
    expect(safeHref('not a url at all')).toBeNull()
  })

  it('rejects schemes outside the allowlist, including unknown ones', () => {
    expect(safeHref('ftp://example.com/a')).toBeNull()
    expect(safeHref('about:blank')).toBeNull()
    expect(safeHref('intent://evil#Intent;end')).toBeNull()
    expect(safeHref('derlg://open')).toBeNull()
  })

  it('allows absolute https and http URLs', () => {
    expect(safeHref('https://receipts.stripe.com/abc')).toBe('https://receipts.stripe.com/abc')
    expect(safeHref('http://localhost:9000/derlg/receipt.pdf')).toBe(
      'http://localhost:9000/derlg/receipt.pdf',
    )
  })

  it('does not mangle a query string or fragment', () => {
    const url = 'https://example.com/r?id=1&sig=abc#top'
    expect(safeHref(url)).toBe(url)
  })

  it('rejects a scheme hidden behind percent-encoding or an entity', () => {
    expect(safeHref('%6Aavascript:alert(1)')).toBeNull()
    expect(safeHref('&#106;avascript:alert(1)')).toBeNull()
  })

  it('does not treat a userinfo-style host as its display host', () => {
    // `good.com@evil.com` navigates to evil.com. Permitted as an absolute https
    // URL by policy, but it must resolve to its real host, not be mistaken.
    const out = safeHref('https://good.com@evil.com/x')
    expect(out).not.toBeNull()
    expect(new URL(out!).hostname).toBe('evil.com')
  })
})

describe('safeImageSrc', () => {
  it.each(SCRIPT_URLS.filter((u) => !u.startsWith('data:image')))('rejects %j', (value) => {
    expect(safeImageSrc(value)).toBeNull()
  })

  it('allows an inline raster image, because the backend mints QR codes that way', () => {
    const qr = 'data:image/png;base64,iVBORw0KGgo='
    expect(safeImageSrc(qr)).toBe(qr)
    expect(safeImageSrc('data:image/jpeg,abc')).toBe('data:image/jpeg,abc')
  })

  it('rejects a data URL that is not an image', () => {
    expect(safeImageSrc('data:text/html,<b>x</b>')).toBeNull()
    expect(safeImageSrc('data:application/javascript,alert(1)')).toBeNull()
  })

  it('rejects inline SVG, which can carry script', () => {
    // An <img> will not execute it, but this helper is exported and a future
    // caller using <object>/<embed> or a navigation would.
    expect(safeImageSrc('data:image/svg+xml,<svg onload=alert(1)/>')).toBeNull()
    expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zy8+')).toBeNull()
  })

  it('rejects a disguised authority in an image path too', () => {
    expect(safeImageSrc('/\\evil.example/a.jpg')).toBeNull()
    expect(safeImageSrc('//evil.example/a.jpg')).toBeNull()
  })

  it('allows ordinary http(s) images', () => {
    expect(safeImageSrc('http://localhost:9000/derlg/a.jpg')).toBe(
      'http://localhost:9000/derlg/a.jpg',
    )
  })
})

describe('agent payloads cannot inject a script URL into the chat', () => {
  function renderBlocks(blocks: Record<string, unknown>[]) {
    renderWithProviders(
      <PayloadBlocks blocks={blocks as unknown as ContentBlock[]} onAsk={vi.fn()} />,
    )
  }

  it('does not render a javascript: receipt link', () => {
    renderBlocks([
      {
        type: 'payment_status',
        data: {
          paymentIntentId: 'pi_1',
          bookingId: 'b1',
          status: 'SUCCEEDED',
          amountUsd: 240,
          receiptUrl: 'javascript:alert(document.cookie)',
        },
      },
    ])

    // The one agent-controlled <a href> in the chat. A rendered anchor here would
    // put the whole conversation one click from script execution.
    expect(screen.queryByRole('link', { name: /view receipt/i })).not.toBeInTheDocument()
  })

  it('still renders a legitimate receipt link', () => {
    renderBlocks([
      {
        type: 'payment_status',
        data: {
          paymentIntentId: 'pi_1',
          bookingId: 'b1',
          status: 'SUCCEEDED',
          amountUsd: 240,
          receiptUrl: 'https://receipts.stripe.com/abc',
        },
      },
    ])

    expect(screen.getByRole('link', { name: /view receipt/i })).toHaveAttribute(
      'href',
      'https://receipts.stripe.com/abc',
    )
  })

  it('drops a hostile card image without losing the card', () => {
    renderBlocks([
      {
        type: 'trip_cards',
        data: {
          trips: [
            {
              id: 't1',
              name: 'Angkor Temple Discovery',
              priceUsd: 189,
              imageUrl: 'data:text/html,<script>alert(1)</script>',
            },
          ],
        },
      },
    ])

    // The card still shows: one bad URL must not cost the user the result.
    expect(screen.getByText('Angkor Temple Discovery')).toBeInTheDocument()
    expect(screen.queryByAltText('Angkor Temple Discovery')).not.toBeInTheDocument()
  })

  it('drops a hostile gallery image but keeps the rest of the gallery', () => {
    renderBlocks([
      {
        type: 'image_gallery',
        data: {
          images: [
            { url: 'javascript:alert(1)', caption: 'Hostile' },
            { url: 'http://localhost:9000/derlg/good.jpg', caption: 'Bayon' },
          ],
        },
      },
    ])

    const good = screen.getByAltText('Bayon')
    expect(good).toHaveAttribute('src', 'http://localhost:9000/derlg/good.jpg')

    /*
     * The hostile entry renders no <img> at all. An `<img src="">` is not inert —
     * browsers resolve the empty string to the current page and fetch it again —
     * so a rejected URL must produce no element rather than an empty one.
     */
    expect(screen.queryByAltText('Hostile')).not.toBeInTheDocument()

    // The property that actually matters: nothing anywhere holds a script URL.
    for (const img of Array.from(document.querySelectorAll('img'))) {
      const src = img.getAttribute('src') ?? ''
      expect(src).not.toMatch(/^\s*(javascript|data:text|vbscript):/i)
      // And no empty src, which would re-request the page.
      expect(src).not.toBe('')
    }
  })
})
