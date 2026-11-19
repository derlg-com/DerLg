'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

export interface CategoryTab {
  id: string
  label: string
}

export interface NavelCategoryTabsProps {
  tabs?: CategoryTab[]
  activeId?: string
  onChange?: (id: string) => void
  className?: string
}

const DEFAULT_TABS: CategoryTab[] = [
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'popular', label: 'Popular' },
  { id: 'temples', label: 'Temples' },
  { id: 'nature', label: 'Nature' },
  { id: 'hotels', label: 'Hotels' },
]

/**
 * NAVEL Category selector tabs with smooth active indicator.
 */
export function NavelCategoryTabs({
  tabs = DEFAULT_TABS,
  activeId = 'recommendation',
  onChange,
  className,
}: NavelCategoryTabsProps) {
  const [selected, setSelected] = React.useState(activeId)

  const handleSelect = (id: string) => {
    setSelected(id)
    onChange?.(id)
  }

  return (
    <div
      role="tablist"
      aria-label="Category Filter"
      className={cn(
        'flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-4 -mx-4 sm:mx-0',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === selected
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => handleSelect(tab.id)}
            className={cn(
              'relative shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 select-none active:scale-95',
              isActive
                ? 'bg-[#1B3232] text-white dark:bg-[#205743] dark:text-white shadow-xs'
                : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] dark:text-[#A1B0B0] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)]/50',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
