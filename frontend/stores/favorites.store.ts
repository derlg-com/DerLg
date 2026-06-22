'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FavoriteType = 'trip' | 'hotel' | 'guide' | 'transport'

function key(type: FavoriteType, id: string): string {
  return `${type}:${id}`
}

interface FavoritesState {
  /** Keys of the form `${type}:${id}`. */
  ids: string[]
  toggle: (type: FavoriteType, id: string) => void
  has: (type: FavoriteType, id: string) => boolean
  list: (type: FavoriteType) => string[]
}

/**
 * Wishlist/favorites — persisted in localStorage only (the backend exposes no
 * favorites endpoints). Reused by trip/hotel/guide cards and the profile wishlist.
 */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (type, id) =>
        set((s) => {
          const k = key(type, id)
          return { ids: s.ids.includes(k) ? s.ids.filter((x) => x !== k) : [...s.ids, k] }
        }),
      has: (type, id) => get().ids.includes(key(type, id)),
      list: (type) =>
        get()
          .ids.filter((k) => k.startsWith(`${type}:`))
          .map((k) => k.slice(type.length + 1)),
    }),
    { name: 'derlg:favorites' },
  ),
)
