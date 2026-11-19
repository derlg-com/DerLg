'use client'

import { ArrowRight, ChevronRight, MapPin } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui'
import { usePathname } from '@/lib/i18n/navigation'
import { cn } from '@/lib/cn'
import { NAVEL_ASSETS } from '@/lib/navel-assets'

interface TourSlide {
  title: string
  location: string
  image: string
}

const SLIDES: TourSlide[] = [
  {
    title: 'Explore the\nbeauty of the\nworld !',
    location: 'Angkor Wat, Cambodia',
    image: NAVEL_ASSETS.onboarding.slide1,
  },
  {
    title: 'Enjoy\nyour travel\nexperience',
    location: 'Koh Rong, Cambodia',
    image: NAVEL_ASSETS.onboarding.slide2,
  },
  {
    title: 'Let’s make\nyour dream\ntravel',
    location: 'Siem Reap, Cambodia',
    image: NAVEL_ASSETS.onboarding.slide3,
  },
]

const STORAGE_KEY = 'derlg_onboarding_tour_seen'

export function ProductTourModal() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [currentSlide, setCurrentSlide] = React.useState(0)

  React.useEffect(() => {
    // In automated testing environments (Playwright, etc.), do not auto-open unless forced
    if (typeof window !== 'undefined' && window.navigator.webdriver) {
      const forceTour = localStorage.getItem('derlg_force_tour') === 'true'
      if (!forceTour) return
    }
    if (pathname?.includes('/design')) {
      return
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        requestAnimationFrame(() => setOpen(true))
      }
    } catch {
      // localStorage may fail in private mode or SSR
    }
  }, [pathname])

  function finishTour() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    setOpen(false)
  }

  function nextSlide() {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      finishTour()
    }
  }

  if (!open || pathname?.includes('/design')) return null

  const slide = SLIDES[currentSlide] ?? SLIDES[0]!

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product Tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm h-[640px] max-h-[90vh] rounded-[36px] overflow-hidden shadow-2xl flex flex-col justify-between border border-white/20">
        {/* Full Bleed Background Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.image}
          alt={slide.location}
          className="absolute inset-0 size-full object-cover transition-opacity duration-700"
        />

        {/* Dark Forest Gradient Overlay matching NAVEL Fading */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1B3232] via-[#1B3232]/50 to-black/30" />

        {/* Top Header: Brand + Skip button */}
        <div className="relative z-10 flex items-center justify-between p-6">
          <div className="flex items-center gap-1.5 rounded-full bg-black/25 backdrop-blur-md px-3 py-1 border border-white/10">
            <span className="size-2 rounded-full bg-[var(--color-navel-jade)]" />
            <span className="text-xs font-bold text-white tracking-wider">DerLg</span>
          </div>

          <button
            type="button"
            onClick={finishTour}
            className="rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/30"
          >
            Skip
          </button>
        </div>

        {/* Bottom Panel */}
        <div className="relative z-10 p-6 space-y-6">
          {/* Location Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-md px-3 py-1 text-xs font-medium text-white/90 border border-white/10">
            <MapPin className="size-3 text-[var(--color-navel-gold)]" />
            <span>{slide.location}</span>
          </div>

          {/* Heading */}
          <h2 className="font-dela text-2xl sm:text-3xl font-extrabold tracking-tight text-white whitespace-pre-line leading-tight drop-shadow-md">
            {slide.title}
          </h2>

          {/* Progress Indicators & Navigation */}
          <div className="flex items-center justify-between pt-2">
            {/* 3 Step Indicator lines */}
            <div className="flex items-center gap-2">
              {SLIDES.map((_, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    idx === currentSlide
                      ? 'w-8 bg-[var(--color-navel-gold)]'
                      : 'w-2 bg-white/40',
                  )}
                />
              ))}
            </div>

            {/* Next / Get Started Button */}
            {currentSlide < SLIDES.length - 1 ? (
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next slide"
                className="flex size-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#1B3232] to-[#3D9676] text-white shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95 border border-white/20"
              >
                <ArrowRight className="size-6" />
              </button>
            ) : (
              <Button
                variant="navelPrimary"
                size="lg"
                onClick={finishTour}
                className="rounded-full px-6 py-3 font-bold shadow-lg shadow-black/40"
              >
                <span>Get Started</span>
                <ChevronRight className="size-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
