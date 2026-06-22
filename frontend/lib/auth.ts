'use client'

import { v4 as uuid } from 'uuid'
import { api, setAccessToken } from './api-client'

const USER_ID_KEY = 'derlg:user_id'
const TOKEN_KEY = 'derlg:access_token'

export interface AuthResult {
  accessToken: string
  userId: string
}

/** Stable per-browser guest id, generated once and persisted. */
export function getStoredUserId(): string {
  if (typeof window === 'undefined') return 'guest'
  let id = window.localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = `guest-${uuid()}`
    window.localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function getStoredToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(TOKEN_KEY) ?? ''
}

function persist(result: AuthResult) {
  window.localStorage.setItem(USER_ID_KEY, result.userId)
  window.localStorage.setItem(TOKEN_KEY, result.accessToken)
}

/** Calls /v1/auth/login or /register; persists token + real user id on success. */
export async function authenticate(
  mode: 'login' | 'register',
  email: string,
  password: string,
): Promise<AuthResult> {
  const data = await api.post<{ accessToken: string; user: { id: string } }>(
    `/v1/auth/${mode}`,
    { email, password },
    { auth: false },
  )
  const result = { accessToken: data.accessToken, userId: data.user.id }
  setAccessToken(result.accessToken)
  persist(result)
  return result
}
