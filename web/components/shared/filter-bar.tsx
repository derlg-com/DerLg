'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Filter surface for catalogue lists.
 *
 * A single instance of the controls, always in the same place in the DOM:
 * permanently visible from `lg` up, and collapsed behind a disclosure below that.
 * An earlier version rendered the children twice (inline plus a bottom sheet),
 * which produced two form controls sharing each label — ambiguous for screen
 * readers and for any test that looks a control up by its label.
 *
 * The toggle carries `aria-expanded`/`aria-controls`, so assistive tech knows the
 * panel exists and whether it is open.
 */
export function FilterBar({
  activeCount,
  onClear,
  children,
  trailing,
}: {
  activeCount: number
  onClear: () => void
  /** The filter controls. Rendered exactly once. */
  children: React.ReactNode
  /** Controls that sit beside the toggle, such as a result count. */
  trailing?: React.ReactNode
}) {
  const t = useTranslations('catalog')
  const [expanded, setExpanded] = React.useState(false)
  const panelId = React.useId()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="lg:hidden"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {t('filters.title')}
          {activeCount > 0 ? <Badge tone="accent">{activeCount}</Badge> : null}
        </Button>

        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X aria-hidden="true" className="size-4" />
            {t('filters.clear')}
          </Button>
        ) : null}

        {trailing ? <div className="ms-auto flex items-center gap-2">{trailing}</div> : null}
      </div>

      <div
        id={panelId}
        className={cn(
          'grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4',
          // Collapsed below lg unless expanded; always laid out inline from lg up.
          expanded ? 'grid' : 'hidden',
          'lg:flex lg:flex-wrap lg:items-end lg:border-0 lg:bg-transparent lg:p-0',
        )}
      >
        {children}
      </div>
    </div>
  )
}
