'use client'

import type { FormEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface FormShellProps {
  title: string
  /** Booking summary card or context shown under the title. */
  summary?: ReactNode
  children: ReactNode
  onSubmit: (e: FormEvent) => void
  submitLabel: string
  submitting?: boolean
  disabled?: boolean
  /** e.g. a 15-minute hold notice. */
  footer?: ReactNode
  className?: string
}

/**
 * Standard booking-form layout: display-font title → summary → fields →
 * full-width gradient submit → optional footer note. Forms keep their own
 * RHF/Zod logic and just pass fields + handlers.
 */
export function FormShell({
  title,
  summary,
  children,
  onSubmit,
  submitLabel,
  submitting,
  disabled,
  footer,
  className,
}: FormShellProps) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('mx-auto max-w-lg space-y-5 px-4 py-4', className)}
    >
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {summary}
      <div className="space-y-4">{children}</div>
      <Button type="submit" variant="gradient" className="w-full" disabled={submitting || disabled}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : submitLabel}
      </Button>
      {footer}
    </form>
  )
}
