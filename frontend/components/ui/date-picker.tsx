'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguageStore } from '@/lib/i18n'
import { formatDate } from '@/lib/format'

export interface DatePickerProps {
  /** Selected date as an ISO `yyyy-MM-dd` string, or empty for no selection. */
  value?: string
  /** Called with the selected ISO `yyyy-MM-dd` string when a day is chosen. */
  onChange?: (value: string) => void
  /** Earliest selectable date (ISO `yyyy-MM-dd`). Days before are disabled. */
  min?: string
  /** Latest selectable date (ISO `yyyy-MM-dd`). Days after are disabled. */
  max?: string
  /** Placeholder shown when no date is selected. */
  placeholder?: string
  disabled?: boolean
  /** Marks the field invalid; sets `aria-invalid` and a destructive border. */
  invalid?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

const MS_PER_DAY = 86_400_000

/** Format a Date as a local `yyyy-MM-dd` string (no timezone shift). */
function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a `yyyy-MM-dd` string into a local Date at midnight, or null when invalid. */
function fromIso(value?: string): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Accessible, dependency-free date picker with a popover calendar.
 * Locale-aware labels come from the active language store via `formatDate`.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
  invalid,
  id,
  className,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const locale = useLanguageStore((s) => s.locale)
  const generatedId = React.useId()
  const buttonId = id ?? generatedId
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selected = React.useMemo(() => fromIso(value), [value])
  const minDate = React.useMemo(() => fromIso(min), [min])
  const maxDate = React.useMemo(() => fromIso(max), [max])

  // The month shown in the grid. We snap to the selected month each time the
  // popover opens (and default to the selection / today on first render),
  // which avoids calling setState from an effect on every value change.
  const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(selected ?? new Date()))

  function openCalendar() {
    setViewMonth(startOfMonth(selected ?? new Date()))
    setOpen(true)
  }

  // Close on outside click / Escape while open.
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function isDisabledDay(day: Date): boolean {
    if (minDate && day.getTime() < minDate.getTime()) return true
    if (maxDate && day.getTime() > maxDate.getTime()) return true
    return false
  }

  function selectDay(day: Date) {
    if (isDisabledDay(day)) return
    onChange?.(toIso(day))
    setOpen(false)
  }

  // Build the 6-row grid (leading days from the previous month padded as blanks).
  const monthStart = startOfMonth(viewMonth)
  const firstWeekday = monthStart.getDay() // 0 = Sunday
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))

  const weekdayLabels = React.useMemo(() => {
    // Use a known week (Sun..Sat) to derive short weekday names for the locale.
    const base = new Date(2024, 0, 7) // a Sunday
    return Array.from({ length: 7 }, (_, i) =>
      formatDate(new Date(base.getTime() + i * MS_PER_DAY), locale, { weekday: 'narrow' }),
    )
  }, [locale])

  const monthLabel = formatDate(monthStart, locale, { month: 'long', year: 'numeric' })
  const todayIso = toIso(new Date())

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={buttonId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-base text-foreground ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'sm:h-10 sm:text-sm',
          invalid && 'border-destructive focus-visible:ring-destructive',
        )}
      >
        <span className={cn(!selected && 'text-muted-foreground')}>
          {selected ? formatDate(selected, locale) : (placeholder ?? '')}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={monthLabel}
          className="absolute left-0 z-50 mt-2 w-[18rem] rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm font-medium text-foreground" aria-live="polite">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {weekdayLabels.map((label, i) => (
              <div
                key={`wd-${i}`}
                className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} className="h-9" />
              const iso = toIso(day)
              const isSelected = value === iso
              const isToday = iso === todayIso
              const dayDisabled = isDisabledDay(day)
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={dayDisabled}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-md text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-30',
                    isSelected
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'text-foreground hover:bg-accent',
                    !isSelected && isToday && 'ring-1 ring-inset ring-primary/50',
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
