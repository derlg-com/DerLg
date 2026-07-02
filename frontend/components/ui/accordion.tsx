'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Minimal, accessible single-open disclosure/accordion (Task 29.3 — FAQ).
 *
 * The project's `components/ui` has no accordion, so this provides a small,
 * dependency-free implementation built on native `<button>` + ARIA
 * (`aria-expanded` / `aria-controls`) with keyboard support inherited from the
 * button element. Each item expands/collapses independently.
 */

export interface AccordionItemData {
  /** Stable key/id for the item. */
  id: string
  question: string
  answer: React.ReactNode
}

export interface AccordionProps {
  items: AccordionItemData[]
  /** Accessible label describing the group (e.g. "Frequently asked questions"). */
  'aria-label'?: string
  className?: string
}

function AccordionItem({ item }: { item: AccordionItemData }) {
  const [open, setOpen] = React.useState(false)
  const panelId = `faq-panel-${item.id}`
  const buttonId = `faq-button-${item.id}`

  return (
    <div className="border-b border-border last:border-b-0">
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{item.question}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pb-4 text-sm text-muted-foreground"
      >
        {item.answer}
      </div>
    </div>
  )
}

export function Accordion({ items, className, ...props }: AccordionProps) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card px-4', className)}
      aria-label={props['aria-label']}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} item={item} />
      ))}
    </div>
  )
}
