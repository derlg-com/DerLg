'use client'

import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  MapPin,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'
import * as React from 'react'

import { RatingBadge } from '@/components/ui/rating-badge'
import { cn } from '@/lib/cn'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { getNavelImage, NAVEL_ASSETS } from '@/lib/navel-assets'
import type { TripDetail, TripSummary } from '@/schemas/domain'

export interface NavelDetailViewProps {
  trip: TripDetail
  relatedTrips?: TripSummary[]
  bookNowLabel?: string
  askAiLabel?: string
  perPersonLabel?: string
  overviewLabel?: string
  itineraryLabel?: string
  includedLabel?: string
}

/**
 * NAVEL UI Kit Destination Detail Screen (`Detail Example - Destination saved`).
 * Full-bleed hero gallery with active thumbnail switcher, floating controls,
 * interactive tabs, and sticky bottom booking bar.
 */
export function NavelDetailView({
  trip,
  relatedTrips: _relatedTrips = [],
  bookNowLabel = 'Book Now',
  askAiLabel = 'Ask AI Concierge',
  perPersonLabel = '/ Person',
  overviewLabel = 'Overview',
  itineraryLabel = 'Itinerary',
  includedLabel = 'Included',
}: NavelDetailViewProps) {
  const router = useRouter()
  const [isSaved, setIsSaved] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'overview' | 'itinerary' | 'included'>('overview')

  // Collect all gallery images with authentic high-res fallbacks
  const images = React.useMemo(() => {
    const list = [
      trip.coverImageUrl || getNavelImage(null, trip.id),
      ...(trip.galleryImageUrls && trip.galleryImageUrls.length > 0
        ? trip.galleryImageUrls
        : NAVEL_ASSETS.thumbnails),
    ]
    return list.filter((img, idx, arr) => arr.indexOf(img) === idx)
  }, [trip])

  const [activeImageIndex, setActiveImageIndex] = React.useState(0)
  const activeImage = images[activeImageIndex] || images[0]!

  const destinationLocation = trip.location || 'Cambodia'

  return (
    <div className="relative pb-32">
      {/* 1. Hero Image Section */}
      <div className="relative w-full h-[420px] sm:h-[480px] overflow-hidden bg-neutral-900">
        {activeImage ? (
          <Image
            src={activeImage}
            alt={trip.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 448px"
            className="object-cover transition-all duration-500 ease-out"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B3232] to-[#244444]" />
        )}

        {/* Top Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />

        {/* Floating Top Controls */}
        <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="size-11 rounded-full bg-black/35 hover:bg-black/55 active:scale-95 text-white backdrop-blur-md flex items-center justify-center border border-white/20 transition-all shadow-sm"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </button>

          {/* Right actions: Rating & Bookmark */}
          <div className="flex items-center gap-2">
            <RatingBadge
              rating={trip.ratingAverage ?? 4.9}
              reviewsCount={trip.ratingCount ?? undefined}
              variant="frosted"
              size="md"
            />

            <button
              type="button"
              onClick={() => setIsSaved((prev) => !prev)}
              aria-label={isSaved ? 'Remove from saved' : 'Save destination'}
              className={cn(
                'size-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all active:scale-95 shadow-sm',
                isSaved
                  ? 'bg-[#E7B171] text-[#1B3232] border-[#E7B171]'
                  : 'bg-black/35 text-white hover:bg-black/55 border-white/20',
              )}
            >
              <Bookmark
                aria-hidden="true"
                className={cn('size-4.5', isSaved && 'fill-current stroke-[2.5px]')}
              />
            </button>
          </div>
        </div>

        {/* Thumbnail Selector Strip on Hero */}
        {images.length > 1 && (
          <div
            role="group"
            aria-label="Photos"
            className="absolute bottom-4 inset-x-4 flex items-center gap-2.5 z-20 overflow-x-auto no-scrollbar py-1"
          >
            {images.slice(0, 5).map((img, idx) => {
              const isSelected = idx === activeImageIndex
              return (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Photo ${idx + 1}`}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'relative size-14 rounded-2xl overflow-hidden shrink-0 border-2 transition-all duration-200 active:scale-95',
                    isSelected
                      ? 'border-white scale-105 shadow-md'
                      : 'border-white/40 opacity-75 hover:opacity-100',
                  )}
                >
                  <Image src={img} alt={`Thumbnail ${idx + 1}`} fill sizes="56px" className="object-cover" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Content Details Section */}
      <div className="relative -mt-6 rounded-t-[32px] bg-[var(--canvas)] pt-6 px-5 space-y-6 z-20 border-t border-[var(--border-subtle)]/30 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        {/* Title & Location Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#F5EADD] text-[#1B3232] dark:bg-[#1E2C2C] dark:text-[#F5EADD]">
              {trip.category ? trip.category.toUpperCase() : 'TOUR'}
            </span>
            <span className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1">
              <Calendar aria-hidden="true" className="size-3.5" />
              {trip.durationDays} {trip.durationDays > 1 ? 'Days' : 'Day'}
            </span>
          </div>

          <h1 className="font-dela text-2xl sm:text-3xl font-bold tracking-tight text-[#1B3232] dark:text-white leading-tight">
            {trip.name}
          </h1>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium">
            <MapPin aria-hidden="true" className="size-3.5 text-[#E7B171] shrink-0" />
            <span>{destinationLocation}</span>
          </div>
        </div>

        {/* Navigation Tabs (`Group/Menu-Horizontal`) */}
        <div className="border-b border-[var(--border-subtle)]/70">
          <div className="flex items-center gap-6">
            {(
              [
                { id: 'overview', label: overviewLabel },
                { id: 'itinerary', label: itineraryLabel },
                { id: 'included', label: includedLabel },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id)
                    document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={cn(
                    'relative py-3 text-sm font-semibold transition-colors duration-200 select-none',
                    isActive
                      ? 'text-[#1B3232] dark:text-[#52C199]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:text-[#A1B0B0]',
                  )}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#1B3232] dark:bg-[#52C199]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 pt-2">
          {/* Overview Section */}
          <section id="overview" className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-[#1B3232] dark:text-white">
              {overviewLabel}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
              {trip.description ||
                'Experience the rich cultural heritage and breathtaking landscapes with our verified local experts.'}
            </p>

            {/* AI Concierge Callout Tile */}
            <Link
              href={`/chat?context=${encodeURIComponent(trip.name)}`}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#F5EADD]/60 dark:bg-[#1A2626] border border-[#B1A699]/30 hover:border-[#1B3232] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#1B3232] dark:bg-[#3D9676] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles aria-hidden="true" className="size-5 text-[#E7B171]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1B3232] dark:text-white">
                    {askAiLabel}
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Ask about best visiting hours, outfits, or custom requests.
                  </p>
                </div>
              </div>
              <MessageSquare aria-hidden="true" className="size-4 text-[#1B3232] dark:text-[#3D9676] shrink-0 transition-transform group-hover:scale-110" />
            </Link>
          </section>

          {/* Itinerary Section */}
          <section id="itinerary" className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-[#1B3232] dark:text-white">
              {itineraryLabel}
            </h2>
            {trip.itineraryDays && trip.itineraryDays.length > 0 ? (
              <ol className="space-y-3">
                {trip.itineraryDays.map((day) => (
                  <li
                    key={day.dayNumber}
                    className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid size-6 place-items-center rounded-full bg-[#1B3232] text-[11px] font-bold text-white">
                        {day.dayNumber}
                      </span>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Day {day.dayNumber} — {day.title}
                      </h4>
                    </div>
                    {day.description && (
                      <p className="text-xs text-[var(--text-secondary)] pl-8">
                        {day.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] py-2">
                Detailed day-by-day itinerary will be customized with your guide upon booking.
              </p>
            )}
          </section>

          {/* Included Section */}
          <section id="included" className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-[#1B3232] dark:text-white">
              {includedLabel}
            </h2>
            {trip.includedItems && trip.includedItems.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {trip.includedItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-[#3D9676]/15 text-[#3D9676] shrink-0 font-bold">
                      <Check aria-hidden="true" className="size-3 stroke-[3px]" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-4 text-[#3D9676]" />
                  Licensed English/Khmer speaking guide
                </li>
                <li className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-4 text-[#3D9676]" />
                  Air-conditioned private transport
                </li>
                <li className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-4 text-[#3D9676]" />
                  Cold bottled water and refreshing towels
                </li>
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* 3. Sticky Bottom Booking Bar (`Fading` + `Text/Price` + `Button/Text/Big`) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#142020]/95 backdrop-blur-xl border-t border-[var(--border-subtle)]/50 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          {/* Price */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B3232] dark:text-white">
                ${trip.priceUsd}
              </span>
              <span className="text-xs font-semibold text-[var(--text-secondary)] dark:text-[#A1B0B0]">
                {perPersonLabel}
              </span>
            </div>
            <span className="text-[10px] text-[#3D9676] font-medium">Free cancellation</span>
          </div>

          {/* Book Now Button */}
          <Link
            href={`/booking/new?type=trip&id=${trip.id}`}
            className="flex-1 max-w-[180px] h-13 rounded-2xl bg-[#1B3232] hover:bg-[#244444] dark:bg-[#3D9676] dark:hover:bg-[#327e63] text-white font-bold text-sm flex items-center justify-center active:scale-[0.98] transition-all shadow-md"
          >
            {bookNowLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
