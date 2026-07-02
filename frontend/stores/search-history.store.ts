'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Maximum number of recent searches retained in localStorage. */
export const MAX_SEARCH_HISTORY = 8

interface SearchHistoryState {
  /** Recent search terms, most recent first. */
  terms: string[]
  /** Record a committed (debounced) search term, de-duped and capped. */
  add: (term: string) => void
  /** Remove a single term from the history. */
  remove: (term: string) => void
  /** Clear the entire search history. */
  clear: () => void
}

/**
 * Recent search history — persisted in localStorage only (the backend exposes
 * no search-history endpoint). Powers the "recent searches" list shown below
 * the search bar when the query is empty, and feeds autocomplete suggestions.
 */
export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      terms: [],
      add: (term) =>
        set((s) => {
          const trimmed = term.trim()
          if (!trimmed) return s
          const next = [
            trimmed,
            ...s.terms.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
          ]
          return { terms: next.slice(0, MAX_SEARCH_HISTORY) }
        }),
      remove: (term) =>
        set((s) => ({ terms: s.terms.filter((t) => t.toLowerCase() !== term.toLowerCase()) })),
      clear: () => set({ terms: [] }),
    }),
    { name: 'derlg:search-history' },
  ),
)
