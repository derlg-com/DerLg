/**
 * Static fallback list of popular Cambodia search terms.
 *
 * Backend gap: the API exposes no popular-/trending-searches endpoint
 * (`/v1/search` only returns results for a query). Until one exists,
 * autocomplete suggestions are derived locally from this curated list plus the
 * user's own recent search history. If a popular-searches endpoint is added
 * later, prefer it over this constant and merge with local history here.
 */
export const POPULAR_SEARCHES: readonly string[] = [
  'Angkor Wat',
  'Siem Reap',
  'Phnom Penh',
  'Koh Rong',
  'Battambang',
  'Kampot',
  'Tonle Sap',
  'Bayon Temple',
]

/**
 * Derive autocomplete suggestions for the current input from recent searches
 * (prioritised) and a static popular-terms list. Matching is case-insensitive
 * prefix/substring; results are de-duped and capped.
 */
export function deriveSuggestions(query: string, history: readonly string[], limit = 6): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const seen = new Set<string>()
  const out: string[] = []

  const push = (term: string) => {
    const key = term.toLowerCase()
    if (key === q || seen.has(key)) return
    if (!key.includes(q)) return
    seen.add(key)
    out.push(term)
  }

  // Recent searches first so personal history outranks generic popular terms.
  for (const term of history) {
    if (out.length >= limit) break
    push(term)
  }
  for (const term of POPULAR_SEARCHES) {
    if (out.length >= limit) break
    push(term)
  }

  return out.slice(0, limit)
}
