'use client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** Build a resumable share link that encodes the live session id. */
export function buildShareLink(sessionId: string): string {
  return `${APP_URL}/vibe-booking?session=${encodeURIComponent(sessionId)}`
}

/** Read a shared session id from the current URL's ?session= param. */
export function getSessionFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('session')
}
