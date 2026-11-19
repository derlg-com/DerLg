'use client'

import * as React from 'react'
import { Bookmark, Compass, MapPin, ArrowRight } from 'lucide-react'
import Image from 'next/image'

import { RatingBadge } from '@/components/ui/rating-badge'
import { Button } from '@/components/ui'
import { Link } from '@/lib/i18n/navigation'
import { NAVEL_ASSETS } from '@/lib/navel-assets'
import { cn } from '@/lib/cn'

interface SavedItem {
  id: string
  name: string
  location: string
  category: string
  rating: number
  priceUsd: number
  image: string
}

const INITIAL_SAVED_ITEMS: SavedItem[] = [
  {
    id: 'kelingking',
    name: 'Kelingking Beach',
    location: 'Nusa Penida, Bali',
    category: 'Destinations',
    rating: 4.9,
    priceUsd: 120,
    image: NAVEL_ASSETS.destinations.kelingking,
  },
  {
    id: 'borobudur',
    name: 'Borobudur Temple',
    location: 'Magelang, Indonesia',
    category: 'Destinations',
    rating: 4.8,
    priceUsd: 85,
    image: NAVEL_ASSETS.destinations.borobudur,
  },
  {
    id: 'angkor',
    name: 'Angkor Wat Sunrise',
    location: 'Siem Reap, Cambodia',
    category: 'Trips',
    rating: 5.0,
    priceUsd: 150,
    image: NAVEL_ASSETS.destinations.angkorWat,
  },
  {
    id: 'machu',
    name: 'Machu Picchu Citadel',
    location: 'Cusco, Peru',
    category: 'Destinations',
    rating: 4.9,
    priceUsd: 210,
    image: NAVEL_ASSETS.destinations.machuPicchu,
  },
]

const TABS = ['All', 'Destinations', 'Trips', 'Hotels']

export default function SavedBookmarksPage() {
  const [items, setItems] = React.useState<SavedItem[]>(INITIAL_SAVED_ITEMS)
  const [selectedTab, setSelectedTab] = React.useState('All')

  const filteredItems = React.useMemo(() => {
    if (selectedTab === 'All') return items
    return items.filter((item) => item.category === selectedTab)
  }, [items, selectedTab])

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      {/* Header matching NAVEL "Your Bookmark" */}
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navel-jade)]">
          Saved Places
        </span>
        <h1 className="font-dela text-2xl sm:text-3xl font-bold tracking-tight text-[#1B3232] dark:text-white">
          Your Bookmark
        </h1>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((tab) => {
          const isActive = selectedTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedTab(tab)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-xs active:scale-95',
                isActive
                  ? 'bg-[#1B3232] text-white dark:bg-[#3D9676]'
                  : 'bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--color-navel-cream)]'
              )}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Items List or Empty State */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="flex size-20 items-center justify-center rounded-full bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface-sunken)] text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)] shadow-inner">
            <Bookmark className="size-10 text-[var(--color-navel-gold)]" />
          </div>
          <div className="space-y-1">
            <h2 className="font-dela text-xl font-bold tracking-tight text-[#1B3232] dark:text-white">
              It&apos;s empty in here
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs">
              Try add some destination to your bookmark to plan your dream vacation.
            </p>
          </div>
          <Link href="/explore">
            <Button variant="navelPrimary" size="md" className="rounded-full px-6">
              <Compass className="size-4 mr-1.5" />
              <span>Explore Now</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="group relative h-[320px] rounded-[24px] overflow-hidden shadow-md border border-black/5 dark:border-white/10 select-none transition-all duration-300 hover:scale-[1.01]"
            >
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1B3232]/95 via-black/30 to-black/20" />

              {/* Top Bar */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-white/20 backdrop-blur-md text-white border border-white/15">
                  {item.category}
                </span>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name} from bookmark`}
                  className="size-8 rounded-full bg-black/40 hover:bg-black/60 text-[var(--color-navel-gold)] backdrop-blur-md flex items-center justify-center border border-white/15 transition-all active:scale-90"
                >
                  <Bookmark className="size-4 fill-current" />
                </button>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-0 inset-x-0 p-4 z-10 space-y-2">
                <h3 className="font-dela text-lg font-bold text-white leading-tight line-clamp-1">
                  {item.name}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-white/85">
                  <MapPin className="size-3 text-[#E7B171] shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/15">
                  <RatingBadge rating={item.rating} variant="frosted" size="sm" />
                  <Link
                    href={`/trips/${item.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/25 hover:bg-white/35 text-white px-3 py-1 text-xs font-bold backdrop-blur-md transition-all active:scale-95"
                  >
                    <span>Book Now</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
