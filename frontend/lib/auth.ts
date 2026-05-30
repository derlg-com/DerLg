'use client'

import { v4 as uuid } from 'uuid'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'
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
  const res = await fetch(`${API_URL}/v1/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Authentication failed')
  }
  const body = (await res.json()) as { accessToken: string; user: { id: string } }
  const result = { accessToken: body.accessToken, userId: body.user.id }
  persist(result)
  return result
}
