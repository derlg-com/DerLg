/** Explore/landing presentation helpers. */

/**
 * A catalog summary earns the "Top rated" badge when it has a strong score
 * backed by enough reviews. Purely data-driven — no fabricated signals.
 */
export function isTopRated(
  ratingAverage: number | null | undefined,
  ratingCount: number | null | undefined,
): boolean {
  return (ratingAverage ?? 0) >= 4.7 && (ratingCount ?? 0) >= 20
}
