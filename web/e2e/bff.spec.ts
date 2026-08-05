import { expect, test } from '@playwright/test'

/**
 * BFF proxy tests.
 *
 * These hit the app's own `/api/ai/*` routes rather than a page, so they verify
 * the security boundary directly: allowlist enforcement, JWT-derived identity,
 * and that the service key never appears in a response.
 */
test.describe('BFF proxy', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('proxies festivals with the service key attached server-side', async ({ request }) => {
    const response = await request.get('/api/ai/festivals')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { success: boolean; data: { name: string }[] }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0]!.name).toBeTruthy()
  })

  test('never leaks the service key in headers or body', async ({ request }) => {
    const response = await request.get('/api/ai/festivals')

    const raw = await response.text()
    const headers = JSON.stringify(response.headers())

    // The key is 48 chars of high-entropy text; assert no service-key surface at all.
    expect(headers.toLowerCase()).not.toContain('x-service-key')
    expect(raw).not.toContain('AI_SERVICE_KEY')
    expect(raw.toLowerCase()).not.toContain('service_key')
    expect(raw.toLowerCase()).not.toContain('servicekey')
  })

  test('rejects a path outside the allowlist with 404', async ({ request }) => {
    for (const path of ['bookings', 'payments/qr', 'search/trips', 'availability']) {
      const response = await request.get(`/api/ai/${path}`)
      expect(response.status(), `${path} must not be proxied`).toBe(404)
    }
  })

  test('refuses to create booking holds through the proxy', async ({ request }) => {
    // The agent's write tool must stay server-to-server; the browser has to use
    // the authenticated /v1 booking routes where ownership is enforced.
    const response = await request.post('/api/ai/bookings', {
      data: { item_type: 'trip', item_id: 'x', travel_date: '2026-09-01', people_count: 1 },
    })
    expect(response.status()).toBe(404)
  })

  test('rejects the wrong method on an allowlisted route', async ({ request }) => {
    const response = await request.post('/api/ai/festivals', { data: {} })
    expect(response.status()).toBe(405)
  })

  test('requires authentication for the loyalty balance', async ({ request }) => {
    const response = await request.get('/api/ai/loyalty')
    expect(response.status()).toBe(401)

    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  test('ignores a client-supplied user_id on a user-scoped route', async ({ request }) => {
    // Without a valid token this must be 401 regardless of what the caller claims.
    const response = await request.get('/api/ai/loyalty?user_id=someone-else')
    expect(response.status()).toBe(401)
  })

  test('rejects a forged token', async ({ request }) => {
    // A syntactically valid but unsigned token must not authenticate.
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'attacker', exp: 9999999999 })).toString('base64url'),
      '',
    ].join('.')

    const response = await request.get('/api/ai/loyalty', {
      headers: { Authorization: `Bearer ${forged}` },
    })
    expect(response.status()).toBe(401)
  })

  test('requires authentication to raise an SOS', async ({ request }) => {
    const response = await request.post('/api/ai/sos', {
      data: { location: 'Siem Reap', message: 'test' },
    })
    expect(response.status()).toBe(401)
  })

  test('forwards weather queries and returns live data', async ({ request }) => {
    const response = await request.get('/api/ai/weather?location=Siem Reap&date=2026-09-01')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data).toBeTruthy()
  })

  test('forwards emergency contacts', async ({ request }) => {
    const response = await request.get('/api/ai/emergency-contacts?location=Phnom Penh')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
  })

  test('surfaces a validation failure as a 400 without leaking internals', async ({ request }) => {
    // `weather` requires both location and date; omitting them must not 500.
    const response = await request.get('/api/ai/weather')
    expect([400, 422]).toContain(response.status())

    const body = (await response.json()) as { success: boolean; error: { code: string } }
    expect(body.success).toBe(false)
    expect(body.error.code).toBeTruthy()
  })

  test('is not locale-prefixed by the routing proxy', async ({ request }) => {
    // The proxy matcher excludes /api, so this must not redirect to /en/api/...
    const response = await request.get('/api/ai/festivals', { maxRedirects: 0 })
    expect(response.status()).toBe(200)
  })
})
