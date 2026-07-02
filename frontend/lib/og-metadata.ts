import type { Metadata } from 'next'

/**
 * Server-side helpers for shareable URLs + Open Graph metadata (task 27.2 /
 * Requirements 33.4, 33.5).
 *
 * Detail route `page.tsx` files are server components, so they can export
 * `generateMetadata` to emit rich link previews (og:title/description/image/url)
 * without touching the `'use client'` view components that render the page.
 *
 * Both helpers degrade gracefully: if the backend fetch fails or returns an
 * unexpected shape, metadata falls back to sane site defaults instead of
 * throwing (which would break the page render).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** Minimal shape we read for OG tags — tolerant of partial/absent fields. */
export interface MetadataEntity {
  name?: string
  title?: string
  description?: string
  summary?: string
  coverImageUrl?: string
  imageUrl?: string
  images?: string[]
}

function isEnvelope(body: unknown): body is { success?: boolean; data?: unknown } {
  return body !== null && typeof body === 'object' && 'data' in (body as object)
}

/**
 * Fetch an entity for metadata generation. Public GET only (no auth headers),
 * with a short timeout. Returns `null` on any failure so callers can fall back
 * to defaults — never throws.
 */
export async function fetchEntityForMetadata(path: string): Promise<MetadataEntity | null> {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, {
      signal: controller.signal,
      // Revalidate hourly — entity content (names/images) changes rarely.
      next: { revalidate: 3600 },
    }).finally(() => clearTimeout(timer))
    if (!res.ok) return null
    const body: unknown = await res.json()
    const data = isEnvelope(body) ? body.data : body
    if (data && typeof data === 'object') return data as MetadataEntity
    return null
  } catch {
    return null
  }
}

function firstImage(entity: MetadataEntity | null): string | undefined {
  if (!entity) return undefined
  return entity.coverImageUrl ?? entity.imageUrl ?? entity.images?.[0]
}

function absoluteUrl(maybeUrl: string | undefined): string | undefined {
  if (!maybeUrl) return undefined
  if (maybeUrl.startsWith('http')) return maybeUrl
  return `${APP_URL}${maybeUrl.startsWith('/') ? '' : '/'}${maybeUrl}`
}

export interface BuildEntityMetadataArgs {
  entity: MetadataEntity | null
  /** App-relative canonical path for the page, e.g. `/trips/123`. */
  path: string
  fallbackTitle: string
  fallbackDescription: string
}

/**
 * Build Next.js {@link Metadata} (including Open Graph tags) from a fetched
 * entity, falling back to provided site defaults when fields are missing.
 */
export function buildEntityMetadata({
  entity,
  path,
  fallbackTitle,
  fallbackDescription,
}: BuildEntityMetadataArgs): Metadata {
  const name = entity?.name ?? entity?.title
  const title = name ? `${name} — DerLg` : fallbackTitle
  const description = entity?.description ?? entity?.summary ?? fallbackDescription
  const image = absoluteUrl(firstImage(entity))
  const pageUrl = `${APP_URL}${path.startsWith('/') ? '' : '/'}${path}`

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'DerLg',
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}
