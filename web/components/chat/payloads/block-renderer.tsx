'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import {
  GuideCardsBlock,
  HotelCardsBlock,
  TransportOptionsBlock,
  TripCardsBlock,
} from '@/components/chat/payloads/cards'
import {
  BookingConfirmedBlock,
  BookingSummaryBlock,
  PaymentStatusBlock,
  QrPaymentBlock,
  StripeCardFormBlock,
} from '@/components/chat/payloads/booking'
import { ComparisonTable } from '@/components/chat/payloads/comparison-table'
import { MapViewBlock } from '@/components/chat/payloads/map-block'
import { CustomTripCardBlock } from '@/components/chat/payloads/rich/custom-trip-card'
import {
  BudgetEstimateBlock,
  HotelDetailBlock,
  ImageGalleryBlock,
  ItineraryBlock,
  TextSummaryBlock,
  TripDetailBlock,
  WeatherBlock,
} from '@/components/chat/payloads/rich'
import type { ContentBlock } from '@/lib/vibe/protocol'
import { parseContentPayload, type ContentPayload } from '@/schemas/vibe-payloads'

/**
 * Renderer registry for agent content blocks.
 *
 * Keyed on `block.type` so adding a block type is a local change. Two deliberate
 * degradation rules:
 *  - a block whose type has no renderer yet renders a small labelled placeholder,
 *    so a reply whose substance is in a card is never silently reduced to its intro
 *    sentence;
 *  - a block that fails validation is skipped rather than throwing, because one
 *    malformed block must not destroy the whole reply.
 */

export interface BlockContext {
  /** Sends a follow-up message on the user's behalf. */
  onAsk: (text: string) => void
  /**
   * Tells the agent a payment finished. The agent RE-VERIFIES with the provider and
   * refuses unauthenticated claims, so this is a notification, not an assertion.
   */
  onPaymentCompleted?: (bookingId: string) => void
  /** Whether the session is signed in; the agent rejects guest payment claims. */
  isAuthenticated?: boolean
  /** Currently selected/focused product ID (e.g. from card or map interaction). */
  selectedProductId?: string | null
  /** Callback to select or focus a product. */
  onSelectProduct?: (id: string | null) => void
}

type Renderer = (payload: ContentPayload, context: BlockContext) => React.ReactNode

const RENDERERS: Partial<Record<ContentPayload['type'], Renderer>> = {
  trip_cards: (payload, ctx) =>
    payload.type === 'trip_cards' ? (
      <TripCardsBlock
        trips={payload.data.trips}
        onAsk={ctx.onAsk}
        selectedProductId={ctx.selectedProductId}
        onSelectProduct={ctx.onSelectProduct}
      />
    ) : null,

  /*
   * Comparison carries the same trip shape under `items`, and the agent emits it
   * whenever a trip search returns exactly two results. It renders as an aligned
   * comparison table rather than a card rail, because the whole point of the block
   * is weighing one option against another on the same axis.
   */
  comparison: (payload, ctx) =>
    payload.type === 'comparison' ? (
      <ComparisonBlock
        items={payload.data.items}
        onAsk={ctx.onAsk}
        selectedProductId={ctx.selectedProductId}
        onSelectProduct={ctx.onSelectProduct}
      />
    ) : null,

  hotel_cards: (payload, ctx) =>
    payload.type === 'hotel_cards' ? (
      <HotelCardsBlock
        hotels={payload.data.hotels}
        onAsk={ctx.onAsk}
        selectedProductId={ctx.selectedProductId}
        onSelectProduct={ctx.onSelectProduct}
      />
    ) : null,

  guide_cards: (payload, ctx) =>
    payload.type === 'guide_cards' ? (
      <GuideCardsBlock
        guides={payload.data.guides}
        onAsk={ctx.onAsk}
        selectedProductId={ctx.selectedProductId}
        onSelectProduct={ctx.onSelectProduct}
      />
    ) : null,

  transport_options: (payload, ctx) =>
    payload.type === 'transport_options' ? (
      <TransportOptionsBlock
        options={payload.data.options}
        onAsk={ctx.onAsk}
        selectedProductId={ctx.selectedProductId}
        onSelectProduct={ctx.onSelectProduct}
      />
    ) : null,

  /* ---------------------------------------------------------- rich blocks */

  trip_detail: (payload, ctx) =>
    payload.type === 'trip_detail' ? (
      <TripDetailBlock data={payload.data} onAsk={ctx.onAsk} />
    ) : null,

  hotel_detail: (payload, ctx) =>
    payload.type === 'hotel_detail' ? (
      <HotelDetailBlock data={payload.data} onAsk={ctx.onAsk} />
    ) : null,

  itinerary: (payload) =>
    payload.type === 'itinerary' ? <ItineraryBlock data={payload.data} /> : null,

  image_gallery: (payload) =>
    payload.type === 'image_gallery' ? <ImageGalleryBlock data={payload.data} /> : null,

  map_view: (payload, ctx) =>
    payload.type === 'map_view' ? (
      <MapViewBlock
        data={payload.data}
        selectedId={ctx.selectedProductId}
        onSelect={ctx.onSelectProduct}
        onAsk={ctx.onAsk}
      />
    ) : null,

  weather: (payload) => (payload.type === 'weather' ? <WeatherBlock data={payload.data} /> : null),

  budget_estimate: (payload) =>
    payload.type === 'budget_estimate' ? <BudgetEstimateBlock data={payload.data} /> : null,

  /* The agent composed a trip and the backend persisted it as a real Trip row. */
  custom_trip_card: (payload) =>
    payload.type === 'custom_trip_card' ? <CustomTripCardBlock data={payload.data} /> : null,

  text_summary: (payload) =>
    payload.type === 'text_summary' ? <TextSummaryBlock data={payload.data} /> : null,

  /* ------------------------------------------------------- booking blocks */

  booking_summary: (payload, ctx) =>
    payload.type === 'booking_summary' ? (
      <BookingSummaryBlock data={payload.data} context={ctx} />
    ) : null,

  booking_confirmed: (payload) =>
    payload.type === 'booking_confirmed' ? <BookingConfirmedBlock data={payload.data} /> : null,

  qr_payment: (payload, ctx) =>
    payload.type === 'qr_payment' ? <QrPaymentBlock data={payload.data} context={ctx} /> : null,

  stripe_card_form: (payload, ctx) =>
    payload.type === 'stripe_card_form' ? (
      <StripeCardFormBlock data={payload.data} context={ctx} />
    ) : null,

  payment_status: (payload, ctx) =>
    payload.type === 'payment_status' ? (
      <PaymentStatusBlock data={payload.data} context={ctx} />
    ) : null,
}

/**
 * A comparison of two or more options.
 *
 * Falls back to the card rail for a single item, since there is nothing to compare
 * — and the table's markers ("cheapest", "top rated") would be meaningless.
 */
function ComparisonBlock({
  items,
  onAsk,
  selectedProductId,
  onSelectProduct,
}: {
  items: Parameters<typeof TripCardsBlock>[0]['trips']
  onAsk: (text: string) => void
  selectedProductId?: string | null
  onSelectProduct?: (id: string | null) => void
}) {
  const t = useTranslations('content')

  if (items.length < 2)
    return (
      <TripCardsBlock
        trips={items}
        onAsk={onAsk}
        title={t('comparison')}
        selectedProductId={selectedProductId}
        onSelectProduct={onSelectProduct}
      />
    )

  return <ComparisonTable items={items} onAsk={onAsk} title={t('comparison')} />
}

/** True when a renderer exists for this block type. */
export function hasRenderer(type: string): boolean {
  return type in RENDERERS
}

/** Renders every block attached to an agent message. */
export function PayloadBlocks({
  blocks,
  ...context
}: { blocks: ContentBlock[] } & BlockContext) {
  if (blocks.length === 0) return null

  return (
    <div className="flex flex-col gap-4" data-testid="payload-blocks">
      {blocks.map((block, index) => (
        // Blocks carry no id, and their order within a message is stable, so the
        // index is a legitimate key here.
        <PayloadBlock key={`${String(block.type)}-${index}`} block={block} context={context} />
      ))}
    </div>
  )
}

function PayloadBlock({
  block,
  context,
}: {
  block: ContentBlock
  context: BlockContext
}) {
  /*
   * Parse ONCE per block, not once per render.
   *
   * Zod returns a fresh object graph on every `safeParse`, so parsing during
   * render handed each renderer new prop identities every time the parent
   * re-rendered — which, during a streamed reply, is on every token. Anything
   * keyed on those identities (the map's marker effect clears and re-fits the
   * whole layer set) then did its work dozens of times per reply.
   */
  const payload = React.useMemo(() => parseContentPayload(block), [block])

  if (!payload) {
    // Malformed or unknown to the schema entirely: skip it rather than throwing.
    if (process.env.NODE_ENV === 'development') {
      console.warn('[chat] dropped unparseable content block', block.type)
    }
    return null
  }

  const renderer = RENDERERS[payload.type]
  if (!renderer) return <UnrenderedBlock type={payload.type} />

  return <>{renderer(payload, context)}</>
}

/**
 * Placeholder for a known block type that has no renderer.
 *
 * The registry currently covers every type the schema declares, so this branch is
 * unreachable today. It is kept — and exported so it stays under test — because a
 * block type added server-side would otherwise vanish silently, making the agent
 * look like it answered with nothing.
 */
export function UnrenderedBlock({ type }: { type: string }) {
  const t = useTranslations('chat')

  return (
    <p
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-tertiary)]"
      data-testid="unrendered-block"
      data-block-type={type}
    >
      {t('blockUnavailable')}
    </p>
  )
}
