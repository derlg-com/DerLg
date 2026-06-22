'use client'

import { motion } from 'framer-motion'

interface Props {
  items: string[]
  onSelect: (text: string) => void
  title?: string
  ariaLabel?: string
}

/**
 * A row of tappable suggestion pills. Used both for the curated welcome prompts
 * (empty state) and the per-answer follow-up chips (TripAdvisor "Plan with AI").
 */
export default function SuggestionChips({ items, onSelect, title, ariaLabel }: Props) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1.5" role="group" aria-label={ariaLabel ?? title}>
      {title && <p className="px-1 text-xs font-medium text-muted-foreground">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {items.map((text, i) => (
          <motion.button
            key={`${i}-${text}`}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.2) }}
            onClick={() => onSelect(text)}
            className="min-h-[40px] rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted active:bg-muted/70"
          >
            {text}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
