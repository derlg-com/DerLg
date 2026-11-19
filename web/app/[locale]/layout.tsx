import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Noto_Sans_Khmer, Noto_Sans_SC, Plus_Jakarta_Sans } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'

import { SessionBootstrap } from '@/components/auth/session-bootstrap'
import { AppShell } from '@/components/layout/app-shell'
import { ThemeScript } from '@/components/layout/theme-script'
import { QueryProvider } from '@/components/providers/query-provider'
import { localeTags, type Locale } from '@/lib/i18n/config'
import { routing } from '@/lib/i18n/routing'

import '../globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

// Khmer and Simplified Chinese need real glyph coverage, not a fallback stack.
const notoKhmer = Noto_Sans_Khmer({
  variable: '--font-noto-khmer',
  subsets: ['khmer'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

const notoSC = Noto_Sans_SC({
  variable: '--font-noto-sc',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'DerLg — Cambodia travel, booked by conversation',
    template: '%s · DerLg',
  },
  description:
    'Book trips, hotels, transport and verified guides across Cambodia. Plan it all by chatting with an AI concierge that speaks English, Chinese and Khmer.',
  applicationName: 'DerLg',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
}

/** Pre-render all three locales at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  const typedLocale = locale as Locale

  return (
    // `lang` carries the full BCP 47 tag so screen readers pick the right voice
    // and the CSS `:lang()` line-height rules for Khmer and Chinese apply.
    <html lang={localeTags[typedLocale]} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap"
          rel="stylesheet"
        />
        <ThemeScript />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${geistSans.variable} ${geistMono.variable} ${notoKhmer.variable} ${notoSC.variable}`}
      >
        <NextIntlClientProvider timeZone="Asia/Phnom_Penh">
          <QueryProvider>
            {/* Restores the session from the httpOnly refresh cookie on load. */}
            <SessionBootstrap />
            <AppShell>{children}</AppShell>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
