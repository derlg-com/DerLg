/**
 * Pure helpers for turning an `agent_message` frame's content into the list of
 * blocks the UI should render. Kept separate from the WebSocket hook so the
 * routing logic is unit-testable without a live socket.
 */

type MaybePayload = { type?: string } | null | undefined

// Card renderers that draw their OWN inline synced map (so a redundant
// standalone map_view block should be dropped when one is present).
const INLINE_MAP_TYPES = ['trip_cards', 'hotel_cards']

function payloadType(p: unknown): string {
  return typeof p === 'object' && p !== null ? ((p as MaybePayload)?.type ?? '') : ''
}

/**
 * Decide which content blocks to render for an `agent_message`.
 *
 * - Prefers the multi-block `content_payloads` list (the new TripAdvisor-style
 *   auto-render), falling back to the singular `content_payload` for back-compat.
 * - Drops a redundant standalone `map_view` block when a trip_cards / hotel_cards
 *   block is present, because those card renderers draw their own synced map
 *   from the cards' coordinates. Other layouts (e.g. comparison) keep the map.
 */
export function resolveContentPayloads(data: {
  content_payloads?: unknown
  content_payload?: unknown
}): unknown[] {
  const list: unknown[] =
    Array.isArray(data.content_payloads) && data.content_payloads.length > 0
      ? data.content_payloads
      : data.content_payload
        ? [data.content_payload]
        : []

  const hasInlineMap = list.some((p) => INLINE_MAP_TYPES.includes(payloadType(p)))
  if (!hasInlineMap) return list
  return list.filter((p) => payloadType(p) !== 'map_view')
}

/** Normalize a raw suggestions field into at most 4 non-empty strings. */
export function sanitizeSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .slice(0, 4)
}

/**
 * Map an app pathname to a short human page label used as chat context
 * ("Asked while viewing X") when the concierge is launched from an app page.
 */
export function pageContextLabel(pathname: string): string {
  const path = (pathname || '/').toLowerCase()
  if (path === '/' || path === '') return 'Home'
  const rules: [string, string][] = [
    ['/search', 'Explore'],
    ['/bookings', 'My Trips'],
    ['/profile', 'Profile'],
    ['/trips', 'Trip details'],
    ['/hotels', 'Hotels'],
    ['/transportation', 'Transport'],
    ['/guides', 'Guides'],
  ]
  for (const [prefix, label] of rules) {
    if (path === prefix || path.startsWith(prefix + '/')) return label
  }
  return 'DerLg'
}
