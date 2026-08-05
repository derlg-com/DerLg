import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"

import { TransportBrowser } from "@/components/transport/transport-browser"
import { Skeleton } from "@/components/ui"
import type { Locale } from "@/lib/i18n/config"
import { absoluteUrl } from "@/lib/seo"

// Filter-driven: a statically prerendered route swallows query-string navigation.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const shell = await getTranslations({ locale, namespace: "shell" })
  return {
    title: shell("nav.transport"),
    alternates: { canonical: absoluteUrl("/transport", locale as Locale) },
  }
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const shell = await getTranslations("shell")

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{shell("nav.transport")}</h1>
      </header>

      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <TransportBrowser />
      </Suspense>
    </div>
  )
}
