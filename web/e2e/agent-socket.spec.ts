import { expect, test } from '@playwright/test'

/**
 * Live agent connectivity.
 *
 * These drive the real socket from inside the browser, which is the only way to
 * verify the origin allowlist and the handshake as the app actually performs them.
 * Skipped when the agent is not running.
 */
test.describe('agent WebSocket', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:8000/health').catch(() => null)
    test.skip(!probe?.ok(), 'agent on :8000 is not reachable')
  })

  test('completes the handshake from the app origin and receives a welcome', async ({ page }) => {
    // Load a page first so the socket carries the app's Origin header, which the
    // agent checks against ALLOWED_WS_ORIGINS.
    await page.goto('/en')

    const result = await page.evaluate(async () => {
      return await new Promise<{ type?: string; prompts?: number; code?: number }>((resolve) => {
        const ws = new WebSocket('ws://localhost:8000/ws/chat')
        const timer = setTimeout(() => resolve({ type: 'timeout' }), 15_000)

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'auth',
              user_id: `guest-${crypto.randomUUID()}`,
              session_id: crypto.randomUUID(),
              preferred_language: 'EN',
            }),
          )
        }

        ws.onmessage = (event) => {
          const frame = JSON.parse(event.data as string) as {
            type: string
            suggested_prompts?: string[]
          }
          if (frame.type === 'conversation_started' || frame.type === 'conversation_resumed') {
            clearTimeout(timer)
            resolve({ type: frame.type, prompts: frame.suggested_prompts?.length ?? 0 })
            ws.close(1000)
          }
        }

        ws.onclose = (event) => {
          clearTimeout(timer)
          resolve({ code: event.code })
        }
      })
    })

    // 4403 would mean the origin allowlist is missing http://localhost:3002.
    expect(result.code).toBeUndefined()
    expect(result.type).toMatch(/conversation_(started|resumed)/)
    expect(result.prompts ?? 0).toBeGreaterThan(0)
  })

  test('answers a ping with a pong, proving the heartbeat works', async ({ page }) => {
    await page.goto('/en')

    const pong = await page.evaluate(async () => {
      return await new Promise<boolean>((resolve) => {
        const ws = new WebSocket('ws://localhost:8000/ws/chat')
        const timer = setTimeout(() => resolve(false), 15_000)

        ws.onopen = () =>
          ws.send(
            JSON.stringify({
              type: 'auth',
              user_id: `guest-${crypto.randomUUID()}`,
              session_id: crypto.randomUUID(),
              preferred_language: 'EN',
            }),
          )

        ws.onmessage = (event) => {
          const frame = JSON.parse(event.data as string) as { type: string }
          if (frame.type === 'conversation_started') ws.send(JSON.stringify({ type: 'ping' }))
          if (frame.type === 'pong') {
            clearTimeout(timer)
            resolve(true)
            ws.close(1000)
          }
        }
      })
    })

    expect(pong).toBe(true)
  })

  test('rejects a handshake that never arrives', async ({ page }) => {
    await page.goto('/en')

    const code = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        const ws = new WebSocket('ws://localhost:8000/ws/chat')
        // Deliberately send nothing: the agent closes after its 10s window.
        ws.onclose = (event) => resolve(event.code)
        setTimeout(() => resolve(-1), 20_000)
      })
    })

    // 4000 is the agent's handshake-failure code.
    expect(code).toBe(4000)
  })

  test('a forged token does not produce an authenticated session', async ({ page }) => {
    await page.goto('/en')

    const outcome = await page.evaluate(async () => {
      const encode = (value: object) =>
        btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const forged = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
        sub: 'attacker',
        exp: 9999999999,
      })}.`

      return await new Promise<{ error?: string; authenticated?: boolean }>((resolve) => {
        const ws = new WebSocket('ws://localhost:8000/ws/chat')
        const timer = setTimeout(() => resolve({}), 20_000)

        ws.onopen = () =>
          ws.send(
            JSON.stringify({
              type: 'auth',
              user_id: 'attacker',
              session_id: crypto.randomUUID(),
              token: forged,
              preferred_language: 'EN',
            }),
          )

        ws.onmessage = (event) => {
          const frame = JSON.parse(event.data as string) as { type: string; message?: string }

          if (frame.type === 'conversation_started') {
            // The agent gates payment confirmation on an authenticated session, so
            // this is an observable probe of whether the token was trusted.
            ws.send(JSON.stringify({ type: 'payment_completed', booking_id: 'probe' }))
            return
          }

          if (frame.type === 'error') {
            clearTimeout(timer)
            resolve({ error: frame.message, authenticated: false })
            ws.close(1000)
          }
        }
      })
    })

    /*
     * The agent does not close the socket on a bad token — it silently degrades to
     * a GUEST session, which is the safer design (no user enumeration, and the
     * conversation still works). The property that matters is that the forged
     * subject buys no privilege: payment confirmation is refused.
     */
    expect(outcome.authenticated).toBe(false)
    expect(outcome.error).toMatch(/verify payment/i)
  })
})
