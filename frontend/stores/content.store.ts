import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ContentItem } from '@/types/vibe-booking'

interface ContentState {
  items: ContentItem[]
  activeId: string | null
  isStreaming: boolean
  addItem: (item: ContentItem) => void
  replaceLatest: (item: ContentItem) => void
  removeItem: (id: string) => void
  setStreaming: (v: boolean) => void
  setActiveId: (id: string | null) => void
}

export const useContentStore = create<ContentState>()((set) => ({
  items: [],
  activeId: null,
  isStreaming: false,
  addItem: (item) =>
    set((s) => ({ items: [...s.items, item], activeId: item.id })),
  replaceLatest: (item) =>
    set((s) => ({
      items: s.items.length > 0 ? [...s.items.slice(0, -1), item] : [item],
      activeId: item.id,
    })),
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setActiveId: (activeId) => set({ activeId }),
}))
