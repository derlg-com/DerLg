'use client'

import { lazy, Suspense, memo, useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useTranslations } from '@/lib/i18n'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

type RendererProps = {
  item: ContentItem
  onAction: (t: string, id?: string, p?: Record<string, unknown>) => void
}

const RENDERERS: Record<string, React.LazyExoticComponent<React.ComponentType<RendererProps>>> = {
  trip_cards: lazy(() => import('./renderers/TripCardsRenderer')),
  hotel_cards: lazy(() => import('./renderers/HotelCardsRenderer')),
  transport_options: lazy(() => import('./renderers/TransportOptionsRenderer')),
  map_view: lazy(() => import('./renderers/MapViewRenderer')),
  itinerary: lazy(() => import('./renderers/ItineraryRenderer')),
  booking_summary: lazy(() => import('./renderers/BookingSummaryRenderer')),
  qr_payment: lazy(() => import('./renderers/QRPaymentRenderer')),
  stripe_card_form: lazy(() => import('./renderers/StripeCardFormRenderer')),
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

interface ItemProps {
  item: ContentItem
  onAction: Props['onAction']
  onDismiss: (id: string) => void
}

const ContentItemView = memo(function ContentItemView({ item, onAction, onDismiss }: ItemProps) {
  const Renderer = RENDERERS[item.type]
  const t = useTranslations()
  const isStreamingItem = item.status === 'streaming'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      role="region"
      aria-label={item.metadata?.title ?? item.type}
      aria-busy={isStreamingItem}
      className={`relative rounded-xl border border-border bg-card shadow-sm overflow-hidden ${
        isStreamingItem ? 'ring-2 ring-primary/40 animate-pulse' : ''
      }`}
    >
      {item.metadata?.title && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{item.metadata.title}</p>
            {item.metadata.subtitle && (
              <p className="text-xs text-muted-foreground">{item.metadata.subtitle}</p>
            )}
          </div>
          <button
            onClick={() => onDismiss(item.id)}
            className="p-1 rounded-full hover:bg-muted"
            aria-label={t('common.close')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {!item.metadata?.title && (
        <button
          onClick={() => onDismiss(item.id)}
          className="absolute top-2 right-2 z-10 p-1 rounded-full hover:bg-muted"
          aria-label={t('common.close')}
        >
          <X size={14} />
        </button>
      )}
      <ErrorBoundary>
        <Suspense
          fallback={<div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>}
        >
          {Renderer ? (
            <Renderer item={item} onAction={onAction} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Unknown content type: {item.type}
            </div>
          )}
        </Suspense>
      </ErrorBoundary>
      {item.actions?.length > 0 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          {item.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction(action.type, item.id, action.payload)}
              className={`text-xs rounded-md px-3 py-1.5 font-medium transition-opacity ${
                action.style === 'primary'
                  ? 'bg-primary text-primary-foreground'
                  : action.style === 'danger'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'border border-border'
              } ${isStreamingItem ? 'opacity-50 pointer-events-none' : ''}`}
              disabled={isStreamingItem}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
})

export default function ContentStage({ onAction }: Props) {
  const contentItems = useVibeBookingStore((s) => s.contentItems)
  const isStreaming = useVibeBookingStore((s) => s.isStreaming)
  const removeContentItem = useVibeBookingStore((s) => s.removeContentItem)
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)

  // Lightweight windowing: when history exceeds 50 items, only render the most
  // recent 30 by default to keep the DOM small. User can opt to expand the
  // older items via "Show older" — preserves perf budget for ContentStage.
  const VIRTUAL_THRESHOLD = 50
  const RECENT_WINDOW = 30
  const isOverThreshold = contentItems.length > VIRTUAL_THRESHOLD
  const hiddenCount = isOverThreshold && !showAll ? contentItems.length - RECENT_WINDOW : 0
  const visibleItems = useMemo(() => {
    if (!isOverThreshold || showAll) return contentItems
    return contentItems.slice(-RECENT_WINDOW)
  }, [contentItems, isOverThreshold, showAll])

  if (contentItems.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
        <p>Trip details, maps, and booking options will appear here as you chat.</p>
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-4"
      role="log"
      aria-live="polite"
      aria-label="Content stream"
    >
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse px-1">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          {t('common.thinking')}
        </div>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full text-xs py-2 rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/40"
        >
          {t('common.loading') /* fallback i18n key */} · Show {hiddenCount} older items
        </button>
      )}
      <AnimatePresence>
        {visibleItems.map((item) => (
          <ContentItemView
            key={item.id}
            item={item}
            onAction={onAction}
            onDismiss={removeContentItem}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
