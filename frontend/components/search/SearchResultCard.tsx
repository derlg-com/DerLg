'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'

export interface SearchResultCardProps {
  href?: string
  imageUrl: string | null
  title: string
  subtitle?: string | null
}

export function SearchResultCard({ href, imageUrl, title, subtitle }: SearchResultCardProps) {
  const inner = (
    <Card variant="interactive" className="flex items-center gap-3 overflow-hidden p-2">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-500 text-white">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 pr-2">
        <p className="line-clamp-1 font-display font-semibold text-foreground">{title}</p>
        {subtitle ? <p className="line-clamp-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </Card>
  )
  return href ? (
    <Link href={href} className="block focus-visible:outline-none">
      {inner}
    </Link>
  ) : (
    inner
  )
}
