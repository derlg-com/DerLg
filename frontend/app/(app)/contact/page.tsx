import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { SupportInfo } from '@/components/contact/SupportInfo'
import { ContactHeading, ContactFormHeading } from '@/components/contact/ContactHeading'
import { absoluteUrl } from '@/lib/site-url'

/**
 * Contact & Support page (Section 29 — Tasks 29.1–29.4).
 *
 * Server-rendered shell (Task 30.6) with a canonical URL (Task 30.3). The
 * interactive form + support panel are client components. The page is public —
 * reachable by guests — so there is no auth gate.
 */
export const metadata: Metadata = {
  title: 'Contact & Support — DerLg',
  description:
    'Get in touch with DerLg support — contact form, email, phone, business hours, FAQ, and live chat with our travel concierge.',
  alternates: { canonical: absoluteUrl('/contact') },
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ContactHeading />
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="contact-form-heading" className="space-y-4">
          <ContactFormHeading />
          <ContactForm />
        </section>
        <SupportInfo />
      </div>
    </div>
  )
}
