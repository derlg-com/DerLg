'use client'

import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import type { ContentItem } from '@/stores/vibe-booking.store'

type RendererProps = { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }

const RENDERERS: Record<string, React.LazyExoticComponent<React.ComponentType<RendererProps>>> = {
  trip_cards: lazy(() => import('./renderers/TripCardsRenderer')),
  hotel_cards: lazy(() => import('./renderers/HotelCardsRenderer')),
  transport_options: lazy(() => import('./renderers/TransportOptionsRenderer')),
  map_view: lazy(() => import('./renderers/MapViewRenderer')),
  itinerary: lazy(() => import('./renderers/ItineraryRenderer')),
  booking_summary: lazy(() => import('./renderers/BookingSummaryRenderer')),
  qr_payment: lazy(() => import('./renderers/QRPaymentRenderer')),
  payment_status: lazy(() => import('./renderers/PaymentStatusRenderer')),
  booking_confirmed: lazy(() => import('./renderers/BookingConfirmedRenderer')),
  budget_estimate: lazy(() => import('./renderers/BudgetEstimateRenderer')),
  weather: lazy(() => import('./renderers/WeatherRenderer')),
  comparison: lazy(() => import('./renderers/ComparisonRenderer')),
  image_gallery: lazy(() => import('./renderers/ImageGalleryRenderer')),
  text_summary: lazy(() => import('./renderers/TextSummaryRenderer')),
}

interface Props {
  onAction: (actionType: string, itemId?: string, payload?: Record<string, unknown>) => void
}

export default function ContentStage({ onAction }: Props) {
  const { contentItems, isStreaming, removeContentItem } = useVibeBookingStore()

  if (contentItems.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
        <p>Trip details, maps, and booking options will appear here as you chat.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse px-1">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          Finding options…
        </div>
      )}
      <AnimatePresence>
        {contentItems.map((item) => {
          const Renderer = RENDERERS[item.type]
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {item.metadata?.title && (
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{item.metadata.title}</p>
                    {item.metadata.subtitle && (
                      <p className="text-xs text-muted-foreground">{item.metadata.subtitle}</p>
                    )}
                  </div>
                  <button onClick={() => removeContentItem(item.id)} className="p-1 rounded-full hover:bg-muted" aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}
              {!item.metadata?.title && (
                <button onClick={() => removeContentItem(item.id)} className="absolute top-2 right-2 z-10 p-1 rounded-full hover:bg-muted" aria-label="Dismiss">
                  <X size={14} />
                </button>
              )}
              <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
                {Renderer ? <Renderer item={item} onAction={onAction} /> : (
                  <div className="p-4 text-sm text-muted-foreground">Unknown content type: {item.type}</div>
                )}
              </Suspense>
              {item.actions?.length > 0 && (
                <div className="px-4 pb-3 flex gap-2 flex-wrap">
                  {item.actions.map((action, i) => (
                    <button key={i} onClick={() => onAction(action.type, undefined, action.payload)}
                      className={`text-xs rounded-md px-3 py-1.5 font-medium ${
                        action.style === 'primary' ? 'bg-primary text-primary-foreground'
                        : action.style === 'danger' ? 'bg-destructive text-destructive-foreground'
                        : 'border border-border'
                      }`}>
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
