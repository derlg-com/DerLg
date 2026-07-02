/**
 * Trip booking price computation (task 11.3, Req 5.4).
 *
 * Pure, framework-agnostic helpers that mirror the backend booking engine so
 * the UI can show a live cost breakdown that recomputes as the traveler counts
 * change. The backend remains the source of truth for the amount actually
 * charged; these figures are an honest preview only.
 *
 * Children-pricing policy: the trip booking engine charges children at the full
 * per-person price. The backend spec defines
 *   totalTravelers = adults + children
 *   subtotalUsd    = pricePerPersonUsd × totalTravelers
 *   totalPriceUsd  = subtotalUsd
 * (see backend/context/feature-specs/.../single-trip/requirements.md). There is
 * currently no child fare, student discount, or loyalty accrual modeled for
 * trip bookings, so this module computes the same way and omits those lines
 * unless explicit values are supplied.
 */

/** A single line in the price breakdown. All amounts are in USD. */
export interface PriceLine {
  /** Stable i18n key suffix used to label the line (e.g. `adults`). */
  key: string
  /** Number of units (travelers) this line represents, when applicable. */
  quantity?: number
  /** Per-unit price in USD, when applicable. */
  unitUsd?: number
  /** Total amount for the line in USD. Negative for discounts. */
  amountUsd: number
}

export interface TripPriceInput {
  /** Per-person price in USD (trip.priceUsd). */
  pricePerPersonUsd: number
  adults: number
  children: number
  /**
   * Optional discount in USD applied to the subtotal (e.g. an approved student
   * discount). Stored as a positive magnitude; shown as a negative line.
   */
  discountUsd?: number
}

export interface TripPriceBreakdown {
  pricePerPersonUsd: number
  adults: number
  children: number
  totalTravelers: number
  subtotalUsd: number
  discountUsd: number
  totalUsd: number
  lines: PriceLine[]
}

/** Clamp to a finite, non-negative integer (guards against NaN from inputs). */
function safeCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/** Clamp to a finite, non-negative amount. */
function safeAmount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/**
 * Compute the trip booking price breakdown. Children are charged at the full
 * per-person price (see module docs). Adults are clamped to a minimum of 1 only
 * for display when a positive count is provided; a zero/invalid adult count
 * yields a zero subtotal rather than throwing.
 */
export function computeTripPrice(input: TripPriceInput): TripPriceBreakdown {
  const pricePerPersonUsd = safeAmount(input.pricePerPersonUsd)
  const adults = safeCount(input.adults)
  const children = safeCount(input.children)
  const totalTravelers = adults + children
  const subtotalUsd = pricePerPersonUsd * totalTravelers

  // A discount can never exceed the subtotal.
  const discountUsd = Math.min(safeAmount(input.discountUsd ?? 0), subtotalUsd)
  const totalUsd = subtotalUsd - discountUsd

  const lines: PriceLine[] = []
  if (adults > 0) {
    lines.push({
      key: 'adults',
      quantity: adults,
      unitUsd: pricePerPersonUsd,
      amountUsd: pricePerPersonUsd * adults,
    })
  }
  if (children > 0) {
    lines.push({
      key: 'children',
      quantity: children,
      unitUsd: pricePerPersonUsd,
      amountUsd: pricePerPersonUsd * children,
    })
  }
  if (discountUsd > 0) {
    lines.push({ key: 'discount', amountUsd: -discountUsd })
  }

  return {
    pricePerPersonUsd,
    adults,
    children,
    totalTravelers,
    subtotalUsd,
    discountUsd,
    totalUsd,
    lines,
  }
}
