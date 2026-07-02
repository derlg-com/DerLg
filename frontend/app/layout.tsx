import type { Metadata, Viewport } from 'next'
import { Sora, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import './globals.css'
import { LanguageSync } from '@/components/shared/LanguageSwitcher'
import { Toaster } from '@/components/ui/toast'
import { AuthProvider } from '@/components/shared/AuthProvider'
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister'
import { ThemeSync } from '@/hooks/use-apply-theme'

/**
 * Runs before first paint to apply the persisted theme to <html>, preventing a
 * flash of the wrong theme (Requirements 27.6, 27.7). Mirrors the persisted
 * Zustand shape ({ state: { theme } }) under the `derlg:preferences` key; on any
 * error it leaves the class unset so the OS preference applies (`system`).
 */
const themeBootstrap = `(function(){try{var s=localStorage.getItem('derlg:preferences');if(!s)return;var t=JSON.parse(s);var theme=t&&t.state&&t.state.theme;if(theme==='light'||theme==='dark'){document.documentElement.classList.add(theme);}}catch(e){}})();`

// Display / headings — geometric, premium.
const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

// Body / UI — friendly, highly readable.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

// Canonical origin for absolute metadata URLs (OG/Twitter). Resolves
// NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_APP_URL → localhost.
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const ROOT_TITLE = 'DerLg — Cambodia Travel, Reimagined'
const ROOT_DESCRIPTION =
  "Cambodia's AI-powered travel platform. Tell our concierge your vibe — it handles discover, plan, book, and pay in one conversation."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: ROOT_TITLE,
  description: ROOT_DESCRIPTION,
  // Next.js auto-links the manifest produced by app/manifest.ts, but we set it
  // explicitly for clarity (Requirement 12.1).
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DerLg',
  },
  // Default social tags (Task 30.4). Detail pages override these via
  // buildEntityMetadata; listing pages inherit these defaults.
  openGraph: {
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
    url: SITE_ORIGIN,
    siteName: 'DerLg',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
  },
}

// PWA viewport / theme color (Requirements 12.1, 12.7).
export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageSync />
        <ThemeSync />
        <ServiceWorkerRegister />
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
