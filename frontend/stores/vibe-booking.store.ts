import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ─── Types ──────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'text' | 'error'
  linkedContentId?: string
  timestamp: string
}

export type ContentType =
  | 'trip_cards'
  | 'trip_detail'
  | 'hotel_cards'
  | 'hotel_detail'
  | 'transport_options'
  | 'map_view'
  | 'itinerary'
  | 'booking_summary'
  | 'qr_payment'
  | 'payment_status'
  | 'booking_confirmed'
  | 'budget_estimate'
  | 'weather'
  | 'comparison'
  | 'image_gallery'
  | 'text_summary'

export interface ContentAction {
  type: string
  label: string
  payload: Record<string, unknown>
  style?: 'primary' | 'secondary' | 'danger'
  icon?: string
}

export interface ContentMetadata {
  title?: string
  subtitle?: string
  icon?: string
  backable?: boolean
  shareable?: boolean
  replace?: boolean
}

export interface ContentItem {
  id: string
  type: ContentType
  data: unknown
  actions: ContentAction[]
  metadata: ContentMetadata
  status: 'ready' | 'streaming' | 'error'
  timestamp: string
  linkedMessageId?: string
}

export interface LayoutConfig {
  dock: 'left' | 'right' | 'center' | 'floating'
  x: number
  y: number
  width: number
  height: number
  collapsed: boolean
}

export type BookingState =
  | { status: 'idle' }
  | { status: 'holding'; bookingId: string; reservedUntil: string }
  | { status: 'paying'; bookingId: string; paymentIntentId: string }
  | { status: 'confirmed'; bookingId: string; bookingRef: string }
  | { status: 'failed'; bookingId: string; error: string }

const DEFAULT_LAYOUT: LayoutConfig = {
  dock: 'right',
  x: 0,
  y: 0,
  width: 420,
  height: 0,
  collapsed: false,
}

interface VibeBookingState {
  // Chat
  messages: ChatMessage[]
  isTyping: boolean
  isStreaming: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  sessionId: string | null
  addMessage: (message: ChatMessage) => void
  setTyping: (v: boolean) => void
  setStreaming: (v: boolean) => void
  setConnectionStatus: (s: VibeBookingState['connectionStatus']) => void
  setSessionId: (id: string) => void
  clearMessages: () => void

  // Content
  contentItems: ContentItem[]
  activeContentId: string | null
  addContentItem: (item: ContentItem) => void
  updateContentItem: (id: string, updates: Partial<ContentItem>) => void
  removeContentItem: (id: string) => void
  clearAllContent: () => void
  setActiveContent: (id: string | null) => void

  // Layout
  layout: LayoutConfig
  setLayout: (layout: Partial<LayoutConfig>) => void
  resetLayout: () => void
  toggleCollapsed: () => void

  // Booking
  booking: BookingState
  setBooking: (booking: BookingState) => void
  clearBooking: () => void
}

export const useVibeBookingStore = create<VibeBookingState>()(
  persist(
    immer((set) => ({
      // Chat
      messages: [],
      isTyping: false,
      isStreaming: false,
      connectionStatus: 'disconnected',
      sessionId: null,
      addMessage: (message) =>
        set((s) => {
          if (s.messages.length >= 50) s.messages.shift()
          s.messages.push(message)
        }),
      setTyping: (v) => set({ isTyping: v }),
      setStreaming: (v) => set({ isStreaming: v }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setSessionId: (sessionId) => set({ sessionId }),
      clearMessages: () => set({ messages: [] }),

      // Content
      contentItems: [],
      activeContentId: null,
      addContentItem: (item) =>
        set((s) => {
          s.contentItems.push(item)
          s.activeContentId = item.id
        }),
      updateContentItem: (id, updates) =>
        set((s) => {
          const idx = s.contentItems.findIndex((i) => i.id === id)
          if (idx !== -1) Object.assign(s.contentItems[idx], updates)
        }),
      removeContentItem: (id) =>
        set((s) => {
          s.contentItems = s.contentItems.filter((i) => i.id !== id)
        }),
      clearAllContent: () => set({ contentItems: [], activeContentId: null }),
      setActiveContent: (activeContentId) => set({ activeContentId }),

      // Layout
      layout: DEFAULT_LAYOUT,
      setLayout: (updates) =>
        set((s) => {
          Object.assign(s.layout, updates)
        }),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),
      toggleCollapsed: () =>
        set((s) => {
          s.layout.collapsed = !s.layout.collapsed
        }),

      // Booking
      booking: { status: 'idle' },
      setBooking: (booking) => set({ booking }),
      clearBooking: () => set({ booking: { status: 'idle' } }),
    })),
    {
      name: 'derlg:vibe-booking',
      partialize: (s) => ({
        messages: s.messages.slice(-50),
        sessionId: s.sessionId,
        layout: s.layout,
      }),
    }
  )
)
