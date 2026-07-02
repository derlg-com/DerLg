'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Permanently deletes the signed-in user's account.
 *
 * Backend contract (assumed): `DELETE /v1/users/me` removes the authenticated
 * account and returns the standard envelope. The backend `UsersController`
 * currently exposes `GET`/`PATCH /v1/users/me` only; this endpoint must be
 * added server-side. The hook degrades gracefully if the call fails — it
 * surfaces the error and does NOT clear the session, so the user is not left in
 * a half-deleted state.
 *
 * On success the local session is cleared (`clearSession`) and the user is
 * redirected home (Requirements 8.8, 50.8).
 */
export function useDeleteAccount() {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    setIsDeleting(true)
    setError(null)
    try {
      await api.delete('/v1/users/me')
      useAuthStore.getState().clearSession()
      router.replace('/')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      return false
    } finally {
      setIsDeleting(false)
    }
  }, [router])

  return { deleteAccount, isDeleting, error }
}
