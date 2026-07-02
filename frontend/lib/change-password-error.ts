import { ApiError } from './api-client'

/**
 * Message keys (under the `profile.password` namespace) used to surface
 * change-password failures to the user. Kept separate from the React component
 * so the mapping can be unit-tested in isolation.
 */
export type ChangePasswordErrorKey =
  'errors.incorrectCurrent' | 'errors.notImplemented' | 'errors.generic'

/**
 * Map an error thrown by {@link changePasswordRequest} to a localized message
 * key (Requirement 8.5).
 *
 * - `401` / `400`  → the current password was rejected ("incorrect current").
 * - `404`          → the backend endpoint isn't implemented yet (documented
 *                    contract assumption — see `auth-api.ts`). Surface a clear,
 *                    distinct message so this state is debuggable in the field.
 * - anything else  → a generic failure message.
 */
export function changePasswordErrorKey(err: unknown): ChangePasswordErrorKey {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 400) return 'errors.incorrectCurrent'
    if (err.status === 404) return 'errors.notImplemented'
  }
  return 'errors.generic'
}
