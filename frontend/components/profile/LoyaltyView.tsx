'use client'

import { useState } from 'react'
import { Gift, History, Sparkles, TrendingUp } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatDateShort, formatCurrency } from '@/lib/format'
import { computeTierProgress, pointsToUsd, POINTS_PER_USD } from '@/lib/loyalty-tiers'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import type { UserProfile, Paginated, LoyaltyLedgerEntry } from '@/types/api'

/**
 * Backend-contract assumption (documented in {@link LoyaltyLedgerEntry}):
 * - Balance comes from `GET /v1/users/me` (`loyaltyPoints`), which exists today.
 * - Points history is fetched from an assumed `GET /v1/users/me/loyalty/history`
 *   returning a `Paginated<LoyaltyLedgerEntry>`. This endpoint does not exist
 *   yet, so the view DEGRADES GRACEFULLY: the balance, tier progress, and
 *   redemption sections render from the balance alone, and the history section
 *   shows an empty/unavailable state when the endpoint errors.
 */
const HISTORY_PAGE_SIZE = 10

function TierProgressCard({ points }: { points: number }) {
  const t = useTranslations('profile')
  const { current, next, pointsToNext, percent } = computeTierProgress(points)

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-medium text-foreground">{t(`loyalty.tier.${current.id}`)}</span>
        </div>
        {next ? (
          <Badge variant="muted">{t(`loyalty.tier.${next.id}`)}</Badge>
        ) : (
          <Badge variant="success">{t('loyalty.maxTier')}</Badge>
        )}
      </div>
      <Progress
        value={percent}
        max={100}
        variant={next ? 'default' : 'success'}
        label={t('loyalty.progressLabel')}
      />
      <p className="text-sm text-muted-foreground">
        {next
          ? t('loyalty.pointsToNext', {
              points: pointsToNext.toLocaleString(),
              tier: t(`loyalty.tier.${next.id}`),
            })
          : t('loyalty.maxTierDesc')}
      </p>
    </Card>
  )
}

function RedemptionCard({ points }: { points: number }) {
  const t = useTranslations('profile')
  const locale = useLanguageStore((s) => s.locale)
  const usdValue = pointsToUsd(points)

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{t('loyalty.redeem.title')}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('loyalty.redeem.rate', { points: POINTS_PER_USD })}
      </p>
      <p className="text-sm text-foreground">
        {t('loyalty.redeem.worth', { value: formatCurrency(usdValue, locale) })}
      </p>
      <p className="text-xs text-muted-foreground">{t('loyalty.redeem.applyHint')}</p>
    </Card>
  )
}

function HistoryEntryRow({ entry }: { entry: LoyaltyLedgerEntry }) {
  const t = useTranslations('profile')
  const locale = useLanguageStore((s) => s.locale)
  const earned = entry.points >= 0

  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{entry.description}</p>
        <p className="text-xs text-muted-foreground">{formatDateShort(entry.createdAt, locale)}</p>
        {entry.expiresAt ? (
          <p className="text-xs text-muted-foreground">
            {t('loyalty.history.expires', { date: formatDateShort(entry.expiresAt, locale) })}
          </p>
        ) : null}
      </div>
      <span
        className={
          earned
            ? 'shrink-0 text-sm font-semibold text-success'
            : 'shrink-0 text-sm font-semibold text-muted-foreground'
        }
      >
        {earned ? '+' : ''}
        {entry.points.toLocaleString()}
      </span>
    </li>
  )
}

function HistorySection() {
  const t = useTranslations('profile')
  const [page, setPage] = useState(1)
  const query = buildQuery({ page, limit: HISTORY_PAGE_SIZE })
  const { data, error, isLoading } = useApiQuery<Paginated<LoyaltyLedgerEntry>>(
    `/v1/users/me/loyalty/history${query}`,
    // History is optional/assumed — don't hammer the (possibly missing) endpoint.
    { retry: 0 },
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-medium text-foreground">{t('loyalty.history.title')}</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : error ? (
        // Graceful degradation: history endpoint unavailable.
        <EmptyState
          icon={History}
          title={t('loyalty.history.unavailable')}
          description={t('loyalty.history.unavailableDesc')}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('loyalty.history.empty')}
          description={t('loyalty.history.emptyDesc')}
        />
      ) : (
        <>
          <Card className="px-4 py-1">
            <ul>
              {data.items.map((entry) => (
                <HistoryEntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </Card>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </section>
  )
}

function Inner() {
  const t = useTranslations('profile')
  const { data: user, isLoading, error } = useApiQuery<UserProfile>('/v1/users/me')
  const points = user?.loyaltyPoints ?? 0

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-4">
      <h1 className="text-xl font-bold text-foreground">{t('loyalty.title')}</h1>

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : error ? (
        <EmptyState
          icon={Sparkles}
          title={t('loyalty.balanceError')}
          description={t('loyalty.balanceErrorDesc')}
        />
      ) : (
        <>
          {/* Balance (Requirement 34.1) */}
          <Card className="flex flex-col items-center gap-1 p-6 text-center">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
            <span className="font-display text-4xl font-bold tracking-tight text-foreground">
              {points.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">{t('loyalty.balanceLabel')}</span>
          </Card>

          {/* Progress toward next tier (Requirement 34.8) */}
          <TierProgressCard points={points} />

          {/* Redemption options & conversion rate (Requirement 34.6) */}
          <RedemptionCard points={points} />

          {/* Paginated points history (Requirement 34.2, 34.4, 34.5) */}
          <HistorySection />
        </>
      )}
    </div>
  )
}

export function LoyaltyView() {
  return (
    <BookingShell>
      <Inner />
    </BookingShell>
  )
}
