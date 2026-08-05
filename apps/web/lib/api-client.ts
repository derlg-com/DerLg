/**
 * Typed fetch wrapper for the DerLg API.
 *
 * Responsibilities:
 *  - unwrap the `{ success, data, message, meta }` envelope
 *  - turn an error envelope into a typed `ApiError` (never a raw string throw)
 *  - always send the refresh cookie (`credentials: 'include'`)
 *  - on a 401, refresh once and replay the request, with all concurrent
 *    callers sharing a single in-flight refresh (single-flight)
 *
 * The access token lives in memory only (see stores/auth.store.ts); it is never
 * written to localStorage, so an XSS payload cannot read it back out.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
  requestId?: string;
}

interface ErrorEnvelope {
  success: false;
  data: null;
  message: string;
  error: { code: string; details?: Record<string, unknown> };
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Field-level messages produced by the API's ValidationPipe, if any. */
  get fieldErrors(): string[] {
    const fields = this.details?.fields;
    return Array.isArray(fields) ? fields.filter((entry): entry is string => typeof entry === 'string') : [];
  }
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101/v1';

type TokenReader = () => string | null;
type TokenWriter = (accessToken: string | null) => void;

let readAccessToken: TokenReader = () => null;
let writeAccessToken: TokenWriter = () => {};

/**
 * Wires the client to the auth store. Called once from the store module so that
 * this file stays free of React and can be unit tested in isolation.
 */
export function configureAuthBridge(reader: TokenReader, writer: TokenWriter): void {
  readAccessToken = reader;
  writeAccessToken = writer;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Extra headers; `Authorization` and `Content-Type` are handled for you. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Set false for the auth endpoints themselves to avoid refresh recursion. */
  retryOnUnauthorized?: boolean;
  /** Send the access token if we have one. Defaults to true. */
  authenticated?: boolean;
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Refreshes the session. Concurrent callers await the same promise so a burst
 * of 401s produces exactly one refresh request.
 */
export async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        writeAccessToken(null);
        return null;
      }

      const envelope = (await response.json()) as SuccessEnvelope<{ accessToken: string }>;
      const token = envelope.data?.accessToken ?? null;
      writeAccessToken(token);
      return token;
    } catch {
      writeAccessToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function parseEnvelope<T>(response: Response): Promise<SuccessEnvelope<T>> {
  let payload: SuccessEnvelope<T> | ErrorEnvelope | null = null;

  try {
    payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  } catch {
    // A non-JSON body (proxy error page, empty 502) still needs a typed failure.
    throw new ApiError(
      response.status,
      'NETWORK_ERROR',
      'The server returned an unreadable response.',
    );
  }

  if (!payload || payload.success === false) {
    const error = payload as ErrorEnvelope | null;
    throw new ApiError(
      response.status,
      error?.error?.code ?? 'UNKNOWN',
      error?.message ?? 'Request failed.',
      error?.error?.details,
      error?.requestId,
    );
  }

  return payload;
}

async function performRequest(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, headers = {}, signal, authenticated = true } = options;
  const token = authenticated ? readAccessToken() : null;

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Issues a request and returns the unwrapped `data`. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retryOnUnauthorized = true } = options;

  let response: Response;
  try {
    response = await performRequest(path, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach DerLg. Check your connection.');
  }

  if (response.status === 401 && retryOnUnauthorized) {
    const token = await refreshSession();
    if (token) {
      response = await performRequest(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const envelope = await parseEnvelope<T>(response);
  return envelope.data;
}

/** Issues a paginated request and returns both items and pagination meta. */
export async function apiRequestPage<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Page<T>> {
  const { retryOnUnauthorized = true } = options;

  let response: Response;
  try {
    response = await performRequest(path, options);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach DerLg. Check your connection.');
  }

  if (response.status === 401 && retryOnUnauthorized) {
    const token = await refreshSession();
    if (token) {
      response = await performRequest(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const envelope = await parseEnvelope<T[]>(response);
  return {
    items: envelope.data,
    meta: envelope.meta ?? { page: 1, limit: envelope.data.length, total: envelope.data.length, totalPages: 1 },
  };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  getPage: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequestPage<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/** Test-only: clears the shared refresh promise between cases. */
export function __resetRefreshState(): void {
  refreshInFlight = null;
}
