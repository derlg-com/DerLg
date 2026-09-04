/**
 * Derives the conversation's CURRENT STATE from the transcript.
 *
 * The transcript is history; the workspace is state. Spec §17 lists what a
 * conversational booking has to remember — selected trip, current package, current
 * booking, current payment — and those are exactly the things that must not scroll
 * out of view. A 15-minute hold countdown three screens up is a countdown nobody
 * sees expire.
 *
 * Pure and React-free on purpose: the interesting behaviour is "which block wins
 * when several turns each carried one", and that is only worth testing in isolation.
 *
 * Recency rule: the newest turn wins for every slot, so "actually, show me the
 * other one" replaces the focus rather than stacking a second one.
 */
import { parseContentPayload, type ContentPayload } from '@/schemas/vibe-payloads'

import type { Turn } from './transcript'

type PayloadData<T extends ContentPayload['type']> = Extract<ContentPayload, { type: T }>['data']

export type MapViewData = PayloadData<'map_view'>
export type ItineraryData = PayloadData<'itinerary'>
export type GalleryData = PayloadData<'image_gallery'>

/** The single thing the traveller is currently looking at. */
export interface WorkspaceSubject {
  kind: 'trip' | 'hotel' | 'custom_trip'
  id: string
  name: string
  priceUsd: number
  /** `/ person` for trips, `per night` for hotels, total for a composed package. */
  priceUnit: 'perPerson' | 'perNight' | 'total'
  imageUrl?: string
  durationDays?: number
  rating?: number
  lat?: number
  lng?: number
  /** Catalogue detail route, when one exists for this kind. */
  href?: string
}

/** Options currently on the table, so the user can get back to them. */
export interface WorkspaceOptions {
  kind: 'trip' | 'hotel' | 'guide' | 'transport'
  count: number
}

export interface WorkspaceHold {
  bookingId: string
  itemName: string
  travelDate: string
  peopleCount: number
  totalUsd: number
  holdExpiresAt?: string
}

export interface WorkspacePayment {
  bookingId?: string
  paymentIntentId: string
  amountUsd: number
  /** Present for a QR payment, absent for a status-only update. */
  qrUrl?: string
  expiry?: string
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
}

export interface WorkspaceConfirmation {
  bookingRef: string
  tripName: string
  travelDate: string
  qrCode?: string
}

export interface WorkspaceState {
  subject?: WorkspaceSubject
  options?: WorkspaceOptions
  map?: MapViewData
  itinerary?: ItineraryData
  gallery?: GalleryData
  hold?: WorkspaceHold
  payment?: WorkspacePayment
  confirmation?: WorkspaceConfirmation
  /** True when there is anything at all worth showing in the panel. */
  hasContent: boolean
}

export const emptyWorkspace: WorkspaceState = { hasContent: false }

/**
 * Walks the transcript newest-first and fills each slot once.
 *
 * Newest-first rather than a fold over the whole history because "first write
 * wins" then means "most recent wins", and the walk can stop early once every
 * slot is taken.
 */
export function deriveWorkspace(
  turns: Turn[],
  selectedId?: string | null,
): WorkspaceState {
  const state: WorkspaceState = { hasContent: false }
  /*
   * Index of the turn that supplied the subject. Slots that DESCRIBE the subject
   * — its photos, its itinerary, its map — must not be back-filled from a turn
   * older than it, or asking about a second hotel would show the first one's
   * photos under the second one's name.
   */
  let subjectTurn: number | null = null
  /** Turn the map came from, so it can be checked against the subject's turn. */
  let mapTurn: number | null = null

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    if (!turn || turn.kind !== 'agent' || turn.blocks.length === 0) continue

    // Older than the subject: only subject-independent slots may still be filled.
    const describesSubject = subjectTurn === null || index >= subjectTurn
    const hadMap = state.map !== undefined

    /*
     * Within a turn, walk blocks in reverse too. The agent appends its derived
     * map_view last and emits detail blocks after the cards they elaborate, so
     * reverse order inside the turn keeps "latest" consistent at both levels.
     */
    for (let b = turn.blocks.length - 1; b >= 0; b -= 1) {
      const payload = parseContentPayload(turn.blocks[b])
      if (payload) applyPayload(state, payload, describesSubject)
    }

    if (!hadMap && state.map !== undefined) mapTurn = index
    if (state.subject && subjectTurn === null) subjectTurn = index
    if (isComplete(state)) break
  }

  reconcile(state, subjectTurn, mapTurn)

  // If a specific product was clicked/selected by the user, focus it in subject
  if (selectedId) {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index]
      if (!turn || turn.kind !== 'agent') continue
      for (const block of turn.blocks) {
        const payload = parseContentPayload(block)
        if (!payload) continue
        if (payload.type === 'trip_cards' || payload.type === 'comparison') {
          const list = payload.type === 'trip_cards' ? payload.data.trips : payload.data.items
          const found = list.find((t) => t.id === selectedId)
          if (found) {
            state.subject = {
              kind: 'trip',
              id: found.id,
              name: found.name,
              priceUsd: found.priceUsd,
              priceUnit: 'perPerson',
              imageUrl: found.imageUrl,
              durationDays: found.durationDays,
              rating: found.rating,
              lat: found.lat,
              lng: found.lng,
              href: `/trips/${found.id}`,
            }
            break
          }
        } else if (payload.type === 'hotel_cards') {
          const found = payload.data.hotels.find((h) => h.id === selectedId)
          if (found) {
            state.subject = {
              kind: 'hotel',
              id: found.id,
              name: found.name,
              priceUsd: found.priceUsd,
              priceUnit: 'perNight',
              imageUrl: found.imageUrl,
              rating: found.rating,
              lat: found.lat,
              lng: found.lng,
              href: `/hotels/${found.id}`,
            }
            break
          }
        }
      }
      if (state.subject?.id === selectedId) break
    }
  }

  state.hasContent = Boolean(
    state.subject ??
      state.options ??
      state.map ??
      state.itinerary ??
      state.gallery ??
      state.hold ??
      state.payment ??
      state.confirmation,
  )

  return state
}

/**
 * Drops slots that survived the walk but do not belong together.
 *
 * Each slot is filled independently by "newest wins", which is right in isolation
 * and wrong in combination: two slots can end up describing two different things
 * and the panel would present them as one coherent state. This is where those
 * pairings are checked.
 */
function reconcile(
  state: WorkspaceState,
  subjectTurn: number | null,
  mapTurn: number | null,
): void {
  /*
   * A map from a DIFFERENT turn than the subject is a map of something else — the
   * agent derives map_view from the cards in that same turn. Showing it under the
   * subject's heading would put a hotel search's pins beneath a trip's name. The
   * subject's own coordinate still feeds the Google Maps links.
   */
  if (state.map && subjectTurn !== null && mapTurn !== null && mapTurn !== subjectTurn) {
    delete state.map
  }

  /*
   * A hold and a payment for DIFFERENT bookings must never be shown together.
   *
   * This is the money case: hold A, then a QR for A, then hold B leaves B's
   * summary sitting above A's live, scannable code. Someone reads the total from
   * B and scans the code that pays A. The payment is the one holding real,
   * irreversible consequences, so the hold is the slot that gives way.
   */
  const holdBooking = state.hold?.bookingId
  const paymentBooking = state.payment?.bookingId
  if (holdBooking && paymentBooking && holdBooking !== paymentBooking) {
    delete state.hold
  }
}

/** Every slot filled — no earlier turn can add anything. */
function isComplete(state: WorkspaceState): boolean {
  return Boolean(
    state.subject &&
      state.options &&
      state.map &&
      state.itinerary &&
      state.gallery &&
      state.hold &&
      state.payment &&
      state.confirmation,
  )
}

/**
 * Folds one block into the state.
 *
 * `describesSubject` is false for turns older than the one that set the subject.
 * The slots that portray the subject are skipped in that case, so a newer subject
 * never inherits an older one's photos, itinerary or map.
 */
function applyPayload(
  state: WorkspaceState,
  payload: ContentPayload,
  describesSubject: boolean,
): void {
  switch (payload.type) {
    case 'trip_detail': {
      const d = payload.data
      if (!state.subject) {
        state.subject = {
          kind: 'trip',
          id: d.id,
          name: d.name,
          priceUsd: d.priceUsd,
          priceUnit: 'perPerson',
          href: `/trips/${d.id}`,
          imageUrl: d.imageUrl ?? d.images?.[0],
          durationDays: d.durationDays,
          rating: d.rating,
          lat: d.lat,
          lng: d.lng,
        }
      }
      /*
       * A trip detail carries its own itinerary and photos. Promoting them means
       * "show me option 2" fills the whole workspace from ONE tool call instead of
       * looking half-empty until the user asks twice more.
       *
       * Gated on this detail BEING the current subject: an older detail block must
       * not lend its photos to whatever is selected now.
       */
      if (!describesSubject || state.subject?.id !== d.id) break

      if (!state.itinerary && d.itinerary && d.itinerary.length > 0) {
        state.itinerary = {
          days: d.itinerary.map((day) => ({
            day: day.day,
            title: day.title,
            activities: day.description ? [day.description] : [],
          })),
        }
      }
      if (!state.gallery && d.images && d.images.length > 0) {
        state.gallery = { images: d.images.map((url) => ({ url })) }
      }
      break
    }

    case 'hotel_detail': {
      const d = payload.data
      if (!state.subject) {
        state.subject = {
          kind: 'hotel',
          id: d.id,
          name: d.name,
          priceUsd: d.priceUsd,
          priceUnit: 'perNight',
          href: `/hotels/${d.id}`,
          imageUrl: d.imageUrl ?? d.images?.[0],
          rating: d.rating,
          lat: d.lat,
          lng: d.lng,
        }
      }
      if (!describesSubject || state.subject?.id !== d.id) break

      if (!state.gallery && d.images && d.images.length > 0) {
        state.gallery = { images: d.images.map((url) => ({ url })) }
      }
      break
    }

    case 'custom_trip_card': {
      if (state.subject) break
      const d = payload.data
      state.subject = {
        kind: 'custom_trip',
        id: d.id,
        name: d.title,
        priceUsd: d.totalUsd,
        priceUnit: 'total',
        durationDays: d.durationDays,
        href: `/trips/${d.id}`,
      }
      break
    }

    case 'trip_cards':
      if (!state.options) state.options = { kind: 'trip', count: payload.data.trips.length }
      break

    case 'comparison':
      if (!state.options) state.options = { kind: 'trip', count: payload.data.items.length }
      break

    case 'hotel_cards':
      if (!state.options) state.options = { kind: 'hotel', count: payload.data.hotels.length }
      break

    case 'guide_cards':
      if (!state.options) state.options = { kind: 'guide', count: payload.data.guides.length }
      break

    case 'transport_options':
      if (!state.options) state.options = { kind: 'transport', count: payload.data.options.length }
      break

    case 'map_view':
      if (describesSubject && !state.map && payload.data.markers.length > 0) {
        state.map = payload.data
      }
      break

    case 'itinerary':
      if (describesSubject && !state.itinerary && payload.data.days.length > 0) {
        state.itinerary = payload.data
      }
      break

    case 'image_gallery':
      if (describesSubject && !state.gallery && payload.data.images.length > 0) {
        state.gallery = payload.data
      }
      break

    case 'booking_summary': {
      if (state.hold) break
      const d = payload.data
      state.hold = {
        bookingId: d.bookingId,
        itemName: d.itemName,
        travelDate: d.travelDate,
        peopleCount: d.peopleCount,
        totalUsd: d.totalUsd,
        holdExpiresAt: d.holdExpiresAt,
      }
      break
    }

    /*
     * Payment is the one slot built from TWO block types, and the traversal is
     * newest-first, so the merge rules are inverted from the intuitive reading:
     * whichever block is seen FIRST is the most recent and therefore wins.
     *
     * Both branches guard on payment identity. Without that guard an older
     * SUCCEEDED status grafts itself onto a newer, unpaid QR code — the panel
     * then hides the code and announces "payment successful" for a booking that
     * has not been paid. That is the single worst thing this file could do, so
     * identity is checked in both directions.
     */
    case 'qr_payment': {
      const d = payload.data
      const existing = state.payment
      if (!existing) {
        state.payment = {
          paymentIntentId: d.paymentIntentId,
          amountUsd: d.amount.usd,
          qrUrl: d.qrUrl,
          expiry: d.expiry,
          bookingId: d.bookingId,
        }
        break
      }

      // Backfill only what a status frame cannot carry, and only for the same payment.
      if (!isSamePayment(existing, d)) break
      if (existing.qrUrl === undefined) existing.qrUrl = d.qrUrl
      if (existing.expiry === undefined) existing.expiry = d.expiry
      if (existing.bookingId === undefined) existing.bookingId = d.bookingId
      break
    }

    case 'payment_status': {
      const d = payload.data
      const existing = state.payment

      if (!existing) {
        state.payment = {
          paymentIntentId: d.paymentIntentId,
          bookingId: d.bookingId,
          amountUsd: d.amountUsd,
          status: d.status,
        }
        break
      }

      // A status already recorded came from a later turn; it stays authoritative.
      if (existing.status !== undefined) break
      /*
       * The slot is held by a NEWER qr_payment. This status is older, so it may
       * only annotate the same payment — never rename the slot to a different one.
       */
      if (!isSamePayment(existing, d)) break

      existing.status = d.status
      existing.amountUsd = d.amountUsd
      break
    }

    case 'stripe_card_form': {
      if (state.payment) break
      const d = payload.data
      state.payment = {
        bookingId: d.bookingId,
        paymentIntentId: d.paymentIntentId ?? '',
        amountUsd: d.amount.usd,
        expiry: d.expiry,
      }
      break
    }

    case 'booking_confirmed': {
      if (state.confirmation) break
      const d = payload.data
      state.confirmation = {
        bookingRef: d.bookingRef,
        tripName: d.tripName,
        travelDate: d.travelDate,
        qrCode: d.qrCode,
      }
      break
    }

    // Carry no durable state: they are read once, in the transcript.
    case 'weather':
    case 'budget_estimate':
    case 'text_summary':
      break
  }
}

/**
 * Whether two payment blocks describe the same payment.
 *
 * The payment intent is the strong identifier and is checked FIRST AND ALONE when
 * both sides have one: a booking can be paid twice (attempt one fails, a new code
 * is issued), and those attempts share a booking id while being different payments.
 * Deciding by booking id there would stamp the failed attempt's status onto the
 * live one.
 *
 * The booking id is only a fallback for blocks that carry no intent id —
 * `stripe_card_form` defaults it to '' because nothing mints a PaymentIntent yet.
 */
function isSamePayment(
  existing: WorkspacePayment,
  incoming: { paymentIntentId?: string; bookingId?: string },
): boolean {
  const existingIntent = existing.paymentIntentId
  const incomingIntent = incoming.paymentIntentId

  if (existingIntent !== '' && incomingIntent !== undefined && incomingIntent !== '') {
    // Both identified: the intent decides it outright, match or mismatch.
    return existingIntent === incomingIntent
  }

  return (
    existing.bookingId !== undefined &&
    existing.bookingId !== '' &&
    incoming.bookingId !== undefined &&
    existing.bookingId === incoming.bookingId
  )
}

/** Every mappable point in the workspace, for a Google Maps route handoff. */
export function workspacePoints(state: WorkspaceState): { lat: number; lng: number }[] {
  if (state.map) return state.map.markers.map((m) => ({ lat: m.lat, lng: m.lng }))
  const { subject } = state
  if (subject?.lat !== undefined && subject.lng !== undefined) {
    return [{ lat: subject.lat, lng: subject.lng }]
  }
  return []
}
