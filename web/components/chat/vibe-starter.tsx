'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * The Vibe starter — a first-turn scaffold for "go for a trip by just your prompt".
 *
 * The blank-composer problem is real: told they can ask anything, most people ask
 * nothing. Canned prompt chips help but they are someone else's trip. This builds
 * the user's OWN opening prompt from four taps — mood, length, budget, party — and
 * then sends it as ordinary natural language.
 *
 * Two properties matter:
 *  - it is a shortcut, not a form. Nothing is required, the sentence is shown before
 *    sending, and the user can ignore this entirely and just type.
 *  - it produces PROSE, not a query string. The agent is a language model; handing
 *    it "3d|$300|2pax" would waste the thing it is good at, and the transcript would
 *    read like a machine talking to a machine.
 */

type Mood = 'peaceful' | 'temples' | 'beach' | 'nature' | 'food' | 'nightlife'
type Party = 'solo' | 'couple' | 'family' | 'friends'

const MOODS: Mood[] = ['peaceful', 'temples', 'beach', 'nature', 'food', 'nightlife']
const DURATIONS = [2, 3, 5, 7] as const
const BUDGETS = [100, 200, 300, 500] as const
const PARTIES: Party[] = ['solo', 'couple', 'family', 'friends']

export interface VibeStarterProps {
  onSend: (text: string) => void
  className?: string
}

export function VibeStarter({ onSend, className }: VibeStarterProps) {
  const t = useTranslations('starter')

  const [mood, setMood] = React.useState<Mood | null>(null)
  const [days, setDays] = React.useState<number | null>(null)
  const [budget, setBudget] = React.useState<number | null>(null)
  const [party, setParty] = React.useState<Party | null>(null)

  /*
   * The sentence is assembled from whatever is chosen, so a single tap already
   * yields something sendable. `t.rich` is avoided deliberately: this string is
   * going to the agent as plain text, not to the DOM as markup.
   */
  const prompt = React.useMemo(() => {
    const parts: string[] = []

    parts.push(
      mood ? t(`prompt.moodLead.${mood}`) : t('prompt.moodLeadDefault'),
    )
    if (days !== null) parts.push(t('prompt.days', { count: days }))
    if (party !== null) parts.push(t(`prompt.party.${party}`))
    if (budget !== null) parts.push(t('prompt.budget', { amount: budget }))

    return `${parts.join(' ')} ${t('prompt.tail')}`.replace(/\s+/g, ' ').trim()
  }, [mood, days, budget, party, t])

  const touched = mood !== null || days !== null || budget !== null || party !== null

  return (
    <section
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3',
        className,
      )}
      aria-labelledby="vibe-starter-heading"
      data-testid="vibe-starter"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles aria-hidden="true" className="size-4 text-[var(--accent)]" />
        <h2
          id="vibe-starter-heading"
          className="text-sm font-semibold text-[var(--text-primary)]"
        >
          {t('title')}
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        <ChipGroup
          label={t('moodLabel')}
          options={MOODS.map((value) => ({ value, label: t(`mood.${value}`) }))}
          selected={mood}
          onSelect={(next) => setMood(next)}
        />
        <ChipGroup
          label={t('daysLabel')}
          options={DURATIONS.map((value) => ({
            value,
            label: t('daysOption', { count: value }),
          }))}
          selected={days}
          onSelect={(next) => setDays(next)}
        />
        <ChipGroup
          label={t('partyLabel')}
          options={PARTIES.map((value) => ({ value, label: t(`party.${value}`) }))}
          selected={party}
          onSelect={(next) => setParty(next)}
        />
        <ChipGroup
          label={t('budgetLabel')}
          options={BUDGETS.map((value) => ({
            value,
            label: t('budgetOption', { amount: value }),
          }))}
          selected={budget}
          onSelect={(next) => setBudget(next)}
        />
      </div>

      {/* The exact sentence that will be sent — no hidden reformulation. */}
      <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-2.5">
        <p className="text-xs font-medium text-[var(--text-tertiary)]">{t('previewLabel')}</p>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]" aria-live="polite">
          {prompt}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={() => onSend(prompt)}>
          {t('send')}
        </Button>
        {touched ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMood(null)
              setDays(null)
              setBudget(null)
              setParty(null)
            }}
          >
            {t('reset')}
          </Button>
        ) : null}
      </div>
    </section>
  )
}

/**
 * A single-select chip row.
 *
 * Toggle buttons with `aria-pressed`, NOT `role="radio"`. A radiogroup commits to
 * arrow-key navigation with a roving tabindex, and it forbids deselection — both
 * wrong here, since every chip is optional and re-tapping the active one clears it
 * so a mis-tap is recoverable. Claiming the radio role without honouring its
 * keyboard contract would be worse than not claiming it.
 */
function ChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T | null
  onSelect: (value: T | null) => void
}) {
  const labelId = React.useId()

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected === option.value
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : option.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs',
                'transition-colors duration-[var(--duration-fast)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                'min-h-8 pointer-coarse:min-h-11',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-medium text-[var(--accent-subtle-text)]'
                  : 'border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
