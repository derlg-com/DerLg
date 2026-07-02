'use client'

import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

interface Options {
  /** Margin around the root used to grow/shrink the intersection box. */
  rootMargin?: string
  /** Visibility ratio (0–1) at which the element counts as visible. */
  threshold?: number
  /** Once true, stay true even after the element scrolls back out of view. */
  once?: boolean
}

/** `true` when the runtime can't observe intersections (old browsers / SSR shims). */
function intersectionObserverUnsupported(): boolean {
  return typeof IntersectionObserver === 'undefined'
}

/**
 * Track whether the referenced element is in (or near) the viewport using
 * `IntersectionObserver` (task 17.3 — defer heavy map tiles until visible).
 *
 * Used to avoid loading expensive, below-the-fold widgets (the Google Maps JS
 * library + tiles) until the user actually scrolls them into view, keeping the
 * `/vibe-booking` bundle and network work lean.
 *
 * When `IntersectionObserver` is unavailable the hook fails open (`inView`
 * starts `true`) so content still renders. State is otherwise only updated from
 * the observer callback — never synchronously inside the effect — to satisfy
 * the project's `react-hooks/set-state-in-effect` rule.
 */
export function useInViewport<T extends Element = HTMLDivElement>(
  options: Options = {},
): { ref: RefObject<T | null>; inView: boolean } {
  const { rootMargin = '200px', threshold = 0, once = true } = options
  const ref = useRef<T | null>(null)
  // Lazy initializer: fail open when there's no IntersectionObserver so we don't
  // need a setState-in-effect to reveal the content.
  const [inView, setInView] = useState(intersectionObserverUnsupported)

  useEffect(() => {
    const node = ref.current
    if (!node || intersectionObserverUnsupported()) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin, threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once])

  return { ref, inView }
}
