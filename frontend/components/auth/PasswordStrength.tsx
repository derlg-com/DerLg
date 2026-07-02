'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4

/**
 * Score a password 0-4 based on length and character variety. This is a
 * lightweight client-side heuristic for user feedback only; the Backend_API
 * remains the source of truth for password policy.
 */
export function scorePassword(password: string): PasswordStrengthScore {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  // Very short passwords can never read as strong regardless of variety.
  if (password.length < 8) return Math.min(score, 1) as PasswordStrengthScore
  return Math.min(score, 4) as PasswordStrengthScore
}

const BAR_COLORS = [
  'bg-muted',
  'bg-destructive',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-emerald-500',
] as const

const LABEL_KEYS = ['empty', 'weak', 'fair', 'good', 'strong'] as const

export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const t = useTranslations('account')
  const score = useMemo(() => scorePassword(password), [password])

  if (!password) return null

  const label = t(`passwordStrength.${LABEL_KEYS[score]}`)

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              segment <= score ? BAR_COLORS[score] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p id={id} className="text-xs text-muted-foreground">
        {t('passwordStrength.label')}: <span className="font-medium">{label}</span>
      </p>
    </div>
  )
}
