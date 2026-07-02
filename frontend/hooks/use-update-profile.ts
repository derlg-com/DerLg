'use client'

import { useCallback, useState } from 'react'
import { api } from '@/lib/api-client'
import type { UpdateProfileValues } from '@/schemas/profile'
import type { UserProfile } from '@/types/api'

/**
 * Payload accepted by the backend `PATCH /v1/users/me` endpoint.
 *
 * IMPORTANT: the backend `UpdateProfileDto` names the display-name field
 * `fullName` (not `name`) and the API runs with `forbidNonWhitelisted: true`,
 * so sending `name` is rejected with a 400. This hook is the single place that
 * maps the form's {@link UpdateProfileValues} onto the backend contract.
 */
interface UpdateProfilePayload {
  fullName?: string
  phone?: string
  avatarUrl?: string
}

/**
 * Translate the form values into the backend payload, dropping empty strings so
 * that "leave unchanged" fields are omitted rather than blanked. Email is
 * intentionally absent — it is immutable via this endpoint (see EditProfileForm).
 */
export function toUpdateProfilePayload(values: UpdateProfileValues): UpdateProfilePayload {
  const payload: UpdateProfilePayload = {}
  if (values.name) payload.fullName = values.name
  if (values.phone) payload.phone = values.phone
  if (values.avatarUrl) payload.avatarUrl = values.avatarUrl
  return payload
}

export interface UseUpdateProfileResult {
  /** Submit the profile change. Resolves with the updated profile on success. */
  mutate: (values: UpdateProfileValues) => Promise<UserProfile>
  /** `true` while the PATCH request is in flight (use to disable the submit button). */
  isPending: boolean
  /** The last error thrown by {@link mutate}, or `null`. */
  error: unknown
}

/**
 * Mutation hook for saving the current user's profile via `PATCH /v1/users/me`
 * (Requirement 8.2). Mirrors the project's lightweight hook layer (see
 * {@link useBookings}) rather than React Query, and centralizes the
 * form→backend field mapping so the `name`→`fullName` contract lives in one place.
 */
export function useUpdateProfile(): UseUpdateProfileResult {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const mutate = useCallback(async (values: UpdateProfileValues): Promise<UserProfile> => {
    setIsPending(true)
    setError(null)
    try {
      const updated = await api.patch<UserProfile>('/v1/users/me', toUpdateProfilePayload(values))
      return updated
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutate, isPending, error }
}
