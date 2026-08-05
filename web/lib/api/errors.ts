/**
 * Backend response envelope and error taxonomy.
 *
 * These shapes were captured from the live API rather than taken from the docs,
 * because the real envelope differs in two ways that matter:
 *
 *  1. Pagination lives INSIDE `data` as `{ items, total, page, limit, totalPages }`.
 *     There is no sibling `meta` object.
 *  2. On failure the payload is `{ success: false, error: { code, message } }` —
 *     `error` is an object, not a string, there is no top-level `message`, and
 *     `message` is an array of strings for validation failures.
 */

/** Successful envelope. */
export interface ApiSuccess<T> {
  success: true
  data: T
  message?: string
}

/** Failure envelope. `message` is an array when validation produced many errors. */
export interface ApiFailure {
  success: false
  error: {
    code: string
    message: string | string[]
  }
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

/** Shape returned by every list endpoint, nested inside `data`. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Error codes the UI branches on. The backend defines many more; only the ones
 * that drive different user-facing behaviour are listed, and anything else is
 * handled generically.
 */
export const ApiErrorCode = {
  // Generic
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Auth — drive sign-in prompts and refresh
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_EXISTS: 'AUTH_EMAIL_EXISTS',
  AUTH_INVALID_REFRESH_TOKEN: 'AUTH_INVALID_REFRESH_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',

  // Not-found variants: the backend uses both long and short prefixes
  TRIP_NOT_FOUND: 'TRIP_NOT_FOUND',
  TRP_NOT_FOUND: 'TRP_NOT_FOUND',
  HTL_NOT_FOUND: 'HTL_NOT_FOUND',
  GDE_NOT_FOUND: 'GDE_NOT_FOUND',
  GUI_NOT_FOUND: 'GUI_NOT_FOUND',
  TRNS_NOT_FOUND: 'TRNS_NOT_FOUND',
  TRN_NOT_FOUND: 'TRN_NOT_FOUND',
  PLACE_NOT_FOUND: 'PLACE_NOT_FOUND',
  PLC_NOT_FOUND: 'PLC_NOT_FOUND',
  BKNG_NOT_FOUND: 'BKNG_NOT_FOUND',

  // Booking / availability
  BKNG_UNAVAILABLE: 'BKNG_UNAVAILABLE',
  BKNG_EXPIRED: 'BKNG_EXPIRED',
  BKNG_NOT_AUTHOR: 'BKNG_NOT_AUTHOR',
  BKNG_ALREADY_CANCELLED: 'BKNG_ALREADY_CANCELLED',
  BKNG_CONFIRMED_CANNOT_MODIFY: 'BKNG_CONFIRMED_CANNOT_MODIFY',
  BKNG_NON_REFUNDABLE_WINDOW: 'BKNG_NON_REFUNDABLE_WINDOW',
  TRIP_NO_AVAILABILITY: 'TRIP_NO_AVAILABILITY',
  HTL_NO_AVAILABILITY: 'HTL_NO_AVAILABILITY',
  GDE_UNAVAILABLE: 'GDE_UNAVAILABLE',
  TRNS_UNAVAILABLE: 'TRNS_UNAVAILABLE',

  // Payment — PAY_METHOD_NOT_SUPPORTED is what DEMO_PAYMENTS=false returns
  PAY_METHOD_NOT_SUPPORTED: 'PAY_METHOD_NOT_SUPPORTED',
  PAY_QR_EXPIRED: 'PAY_QR_EXPIRED',
  PAY_NOT_FOUND: 'PAY_NOT_FOUND',

  // Search
  SRCH_QUERY_TOO_SHORT: 'SRCH_QUERY_TOO_SHORT',
  SRC_QUERY_TOO_SHORT: 'SRC_QUERY_TOO_SHORT',
} as const

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode]

/** Codes that mean "this resource does not exist", across both prefix styles. */
const NOT_FOUND_CODES = new Set<string>([
  ApiErrorCode.NOT_FOUND,
  ApiErrorCode.TRIP_NOT_FOUND,
  ApiErrorCode.TRP_NOT_FOUND,
  ApiErrorCode.HTL_NOT_FOUND,
  ApiErrorCode.GDE_NOT_FOUND,
  ApiErrorCode.GUI_NOT_FOUND,
  ApiErrorCode.TRNS_NOT_FOUND,
  ApiErrorCode.TRN_NOT_FOUND,
  ApiErrorCode.PLACE_NOT_FOUND,
  ApiErrorCode.PLC_NOT_FOUND,
  ApiErrorCode.BKNG_NOT_FOUND,
  ApiErrorCode.PAY_NOT_FOUND,
  'RECORD_NOT_FOUND',
  'USR_NOT_FOUND',
])

/** Codes that mean the request needs a valid session. */
const UNAUTHORIZED_CODES = new Set<string>([
  ApiErrorCode.UNAUTHORIZED,
  ApiErrorCode.AUTH_UNAUTHORIZED,
  ApiErrorCode.AUTH_TOKEN_EXPIRED,
  ApiErrorCode.AUTH_INVALID_REFRESH_TOKEN,
  'AUTH_INVALID_TOKEN',
])

/**
 * A failed API call, carrying the backend code so callers can branch on the
 * cause instead of string-matching a message.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** All validation messages when the backend returned an array. */
  readonly messages: string[]

  constructor(options: { status: number; code: string; messages: string[] }) {
    super(options.messages[0] ?? `Request failed with status ${options.status}`)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.messages = options.messages
  }

  get isNotFound(): boolean {
    return this.status === 404 || NOT_FOUND_CODES.has(this.code)
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || UNAUTHORIZED_CODES.has(this.code)
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.code === ApiErrorCode.RATE_LIMIT_EXCEEDED
  }

  /** 5xx and transport failures are worth retrying; client errors are not. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500 || this.isRateLimited
  }
}

/** The request never reached the backend (offline, DNS, CORS, connection refused). */
export class NetworkError extends ApiError {
  constructor(message: string) {
    super({ status: 0, code: 'NETWORK_ERROR', messages: [message] })
    this.name = 'NetworkError'
  }
}

/** The request was aborted by the caller or by the timeout. */
export class TimeoutError extends ApiError {
  constructor(message = 'The request timed out') {
    super({ status: 0, code: 'TIMEOUT', messages: [message] })
    this.name = 'TimeoutError'
  }
}
