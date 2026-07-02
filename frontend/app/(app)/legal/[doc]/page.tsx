import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalDocView } from '@/components/legal/LegalDocView'
import { LEGAL_DOCS, isLegalDoc } from '@/lib/legal'
import { absoluteUrl } from '@/lib/site-url'

/**
 * Legal documents — Terms of Service, Privacy Policy, Cookie Policy
 * (Section 32.1 — Requirements 50.1, 50.2, 50.3). Public, server-rendered
 * shells with canonical URLs; the content renders client-side via i18n so the
 * active language is reflected.
 */

const TITLES: Record<string, string> = {
  terms: 'Terms of Service — DerLg',
  privacy: 'Privacy Policy — DerLg',
  cookies: 'Cookie Policy — DerLg',
}

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>
}): Promise<Metadata> {
  const { doc } = await params
  return {
    title: TITLES[doc] ?? 'Legal — DerLg',
    alternates: { canonical: absoluteUrl(`/legal/${doc}`) },
  }
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  if (!isLegalDoc(doc)) notFound()
  return <LegalDocView doc={doc} />
}
