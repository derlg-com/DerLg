import type { ReactElement } from 'react'

/**
 * Injects a JSON-LD `<script type="application/ld+json">` block (Task 30.2).
 *
 * This is a plain server component (no `'use client'`) so it renders into the
 * server HTML for crawlers. It accepts an already-built schema.org object (see
 * `lib/structured-data.ts`) and renders nothing when `data` is `null`/`undefined`,
 * so detail pages can degrade gracefully when the source entity is missing.
 *
 * The serialized JSON has `<` escaped to `\u003c` to prevent breaking out of the
 * script element with a stray `</script>` in any string field.
 */
export function StructuredData({
  data,
}: {
  data: Record<string, unknown> | null | undefined
}): ReactElement | null {
  if (!data) return null
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
