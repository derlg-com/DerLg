import { ErrorCode } from '../errors/error-codes';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  code: ErrorCode | string;
  details?: Record<string, unknown>;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  message: string;
  error: ApiErrorBody;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Marker shape returned by services/controllers that page their results. */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  };
}

export function isPaginated<T>(value: unknown): value is Paginated<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<Paginated<T>>;
  return Array.isArray(candidate.items) && typeof candidate.meta === 'object';
}
