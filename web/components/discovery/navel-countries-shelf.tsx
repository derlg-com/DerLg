'use client'

import Image from 'next/image'
import * as React from 'react'
import { ArrowRight, Compass } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import { NAVEL_ASSETS } from '@/lib/navel-assets'

export function NavelCountriesShelf() {
  return (
    <section className="space-y-4 pt-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-dela text-xl sm:text-2xl font-bold tracking-tight text-[#1B3232] dark:text-white">
          Popular Countries
        </h2>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-navel-jade)] hover:underline"
        >
          <span>View All</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Horizontal Slider of Countries */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar">
          {NAVEL_ASSETS.countries.map((country) => (
            <Link
              key={country.id}
              href={`/search?country=${encodeURIComponent(country.name)}`}
              className={cn(
                'group relative w-[180px] h-[240px] shrink-0 rounded-[24px] overflow-hidden select-none',
                'shadow-md border border-black/5 dark:border-white/10 transition-all duration-300 hover:scale-[1.02] snap-start'
              )}
            >
              <Image
                src={country.image}
                alt={country.name}
                fill
                sizes="180px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1B3232]/90 via-black/30 to-transparent" />

              <div className="absolute bottom-0 inset-x-0 p-4 z-10 space-y-1">
                <h3 className="font-dela text-lg font-bold text-white leading-tight">
                  {country.name}
                </h3>
                <div className="flex items-center gap-1 text-[11px] font-medium text-white/80">
                  <Compass className="size-3 text-[#E7B171]" />
                  <span>{country.destinationsCount} Destinations</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
