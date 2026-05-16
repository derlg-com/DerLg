'use client'

import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useContentStore } from '@/stores/content.store'
import type { ContentItem } from '@/types/vibe-booking'

// Lazy-loaded renderers
const renderers: Record<string, React.LazyExoticComponent<React.ComponentType<{ item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }>>> = {
  trip_cards: lazy(() => import('./renderers/TripCardsRenderer')),
  qr_payment: lazy(() => import('./renderers/QRPaymentRenderer')),
  booking_confirmed: lazy(() => import('./renderers/BookingConfirmedRenderer')),
  weather: lazy(() => import('./renderers/WeatherRenderer')),
  itinerary: lazy(() => import('./renderers/ItineraryRenderer')),
  budget_estimate: lazy(() => import('./renderers/BudgetEstimateRenderer')),
  comparison: lazy(() => import('./renderers/ComparisonRenderer')),
  image_gallery: lazy(() => import('./renderers/ImageGalleryRenderer')),
  text_summary: lazy(() => import('./renderers/TextSummaryRenderer')),
}

interface Props {
  onAction: (actionType: string, itemId?: string, payload?: Record<string, unknown>) => void
}

export default function ContentStage({ onAction }: Props) {
  const { items, isStreaming, removeItem } = useContentStore()

  if (items.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <p>Trip details will appear here as you chat.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          Finding options…
        </div>
      )}
      <AnimatePresence>
        {items.map((item) => {
          const Renderer = renderers[item.type]
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              <button
                onClick={() => removeItem(item.id)}
                className="absolute top-2 right-2 z-10 p-1 rounded-full hover:bg-muted"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
              <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
                {Renderer ? (
                  <Renderer item={item} onAction={onAction} />
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">Unknown content type: {item.type}</div>
                )}
              </Suspense>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
