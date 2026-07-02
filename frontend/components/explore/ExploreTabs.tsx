'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MapPin, CalendarDays, Map as MapIcon, type LucideIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { PlacesTab } from './PlacesTab'
import { FestivalsTab } from './FestivalsTab'
import { ExploreMapTab } from './ExploreMapTab'
import { PlaceDetailModal } from './PlaceDetailModal'
import { useTranslations } from '@/lib/i18n'

/**
 * The ordered set of Explore tabs. The first entry is the default when no (or an
 * unknown) `?tab=` value is present. Downstream tasks fill in each tab's content:
 * Places (8.2), Festivals (8.3), search (8.4), and the detail modal (8.5); Maps
 * is built in task 9.
 */
export const EXPLORE_TABS = ['places', 'festivals', 'maps'] as const
export type ExploreTab = (typeof EXPLORE_TABS)[number]
export const DEFAULT_EXPLORE_TAB: ExploreTab = 'places'

/**
 * Resolve a raw `?tab=` query value to a known tab, falling back to the default
 * for missing or unrecognized values. Pure and exported for unit testing.
 */
export function resolveExploreTab(raw: string | null | undefined): ExploreTab {
  return EXPLORE_TABS.includes(raw as ExploreTab) ? (raw as ExploreTab) : DEFAULT_EXPLORE_TAB
}

const TAB_ICON: Record<ExploreTab, LucideIcon> = {
  places: MapPin,
  festivals: CalendarDays,
  maps: MapIcon,
}

/**
 * Explore screen tab shell. Owns tab selection and keeps it in sync with the
 * `?tab=` query param so links like `/explore?tab=festivals` deep-link to a tab
 * and selections are shareable. Each tab currently renders a placeholder; the
 * Places/Festivals lists + filtering, search, and detail modal are added by
 * tasks 8.2–8.5, and the interactive map by task 9.
 */
export function ExploreTabs() {
  const t = useTranslations('explore.tabs')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const active = resolveExploreTab(params.get('tab'))

  const onTabChange = (value: string) => {
    const tab = resolveExploreTab(value)
    const next = new URLSearchParams(params.toString())
    next.set('tab', tab)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {t('title')}
      </h1>

      <Tabs value={active} onValueChange={onTabChange}>
        <TabsList aria-label={t('title')} className="w-full justify-start">
          {EXPLORE_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {EXPLORE_TABS.map((tab) => {
          const Icon = TAB_ICON[tab]
          return (
            <TabsContent key={tab} value={tab}>
              {tab === 'places' ? (
                <PlacesTab />
              ) : tab === 'festivals' ? (
                <FestivalsTab />
              ) : tab === 'maps' ? (
                /* Map foundation (task 9.1). Markers/interactions: task 9.2. */
                <ExploreMapTab />
              ) : (
                <EmptyState icon={Icon} title={t(tab)} description={t(`${tab}Placeholder`)} />
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Place detail modal — URL-driven via `?place=<id>` (task 8.5,
          Requirement 4.6). Rendered at the shell level so it overlays whichever
          tab is active and opens/closes purely from the query param. */}
      <PlaceDetailModal />
    </div>
  )
}
