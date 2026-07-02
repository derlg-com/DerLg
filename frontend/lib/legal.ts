/**
 * Legal document model (Section 32.1 — Requirements 50.1, 50.2, 50.3).
 *
 * Each legal document (Terms of Service, Privacy Policy, Cookie Policy) is
 * rendered from a stable list of section keys. The actual copy lives in i18n
 * (`legal.<doc>.sections.<key>.{heading,body}`) so all three languages stay in
 * parity. Keeping only identifiers here makes the content language-neutral and
 * the document structure easy to extend.
 */

export const LEGAL_DOCS = ['terms', 'privacy', 'cookies'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

export function isLegalDoc(value: string): value is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(value)
}

/** Ordered section key suffixes per document (resolved under `legal.<doc>.sections.*`). */
export const LEGAL_SECTIONS: Record<LegalDoc, readonly string[]> = {
  terms: ['acceptance', 'bookings', 'payments', 'cancellations', 'conduct', 'liability', 'changes'],
  privacy: [
    'intro',
    'dataCollected',
    'dataUse',
    'dataSharing',
    'dataRetention',
    'rights',
    'contact',
  ],
  cookies: ['intro', 'whatAreCookies', 'typesUsed', 'essential', 'analytics', 'managing'],
}
