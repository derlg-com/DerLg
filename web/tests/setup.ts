import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// jsdom lacks matchMedia; the theme + reduced-motion code paths depend on it.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

// jsdom lacks ResizeObserver, used by scroll rails and popovers.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom lacks IntersectionObserver, used by lazy sections and rails.
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    root = null
    rootMargin = ''
    thresholds: number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
}

/**
 * Node 25 exposes a global `localStorage` object that shadows jsdom's `Storage`
 * implementation but has none of its methods, so `localStorage.clear()` throws.
 * Install a real in-memory Storage so persistence tests are deterministic.
 */
function createStorage(): Storage {
  let store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store = new Map()
    },
    getItem(key: string) {
      return store.get(String(key)) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(String(key))
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
  } satisfies Storage
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const existing = globalThis[name] as Storage | undefined
  if (typeof existing?.clear !== 'function') {
    const storage = createStorage()
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true })
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true })
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
