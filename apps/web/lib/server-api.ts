import { API_BASE_URL } from '@/lib/api-client';

/**
 * Server-side reader for public catalogue endpoints.
 *
 * Server components cannot use the browser api-client (no access token, no
 * cookie jar), and public catalogue data benefits from Next's fetch cache, so
 * these reads go through here instead. Returns `null` on 404 so pages can call
 * `notFound()`.
 */
export async function fetchPublic<T>(
  path: string,
  options: { revalidateSeconds?: number } = {},
): Promise<T | null> {
  const { revalidateSeconds = 300 } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: revalidateSeconds },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Catalogue request failed: ${path} returned ${response.status}`);
  }

  const envelope = (await response.json()) as { success: boolean; data: T };
  return envelope.data;
}
