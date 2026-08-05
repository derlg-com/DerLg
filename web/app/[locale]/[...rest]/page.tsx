import { notFound } from 'next/navigation'

/**
 * Catch-all for unmatched paths under a valid locale prefix.
 *
 * Without this, Next renders the framework-level `/_not-found` route, which sits
 * outside `app/[locale]/layout.tsx` and therefore has no `lang` attribute, no
 * fonts and no theme. Routing unmatched paths through here keeps the localised
 * 404 inside the locale layout.
 */
export default function CatchAllNotFound() {
  notFound()
}
