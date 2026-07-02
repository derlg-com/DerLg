'use client'

import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ReviewSummaryCard } from './ReviewSummaryCard'
import { ReviewItem } from './ReviewItem'
import type { Review, ReviewSort, ReviewSubjectType, ReviewsResponse } from '@/types/domain'

const PAGE_SIZE = 5
const SORT_OPTIONS: ReviewSort[] = ['recent', 'rating_desc']
const RATING_FILTERS = [0, 5, 4, 3, 2, 1] as const

export interface ReviewsSectionProps {
  /** Subject the reviews belong to. */
  subjectType: ReviewSubjectType
  /** Subject id (trip id). */
  subjectId: string
}

function ReviewsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-24 w-full rounded-2xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Reviews & ratings section for a subject detail page (task 10.3 — display
 * only). Renders the aggregate {@link ReviewSummaryCard}, sort + rating-filter
 * controls, a paginated list of {@link ReviewItem}s with a "show more"
 * affordance, loading skeletons, and an empty state.
 *
 * Reviews API contract assumption (no backend module exists yet):
 *   GET /v1/reviews?type=<subjectType>&id=<subjectId>&sort=<sort>
 *       &minRating=<n>&page=<n>&limit=<n>
 * returns, in the `{ success, data }` envelope's `data`, a
 * {@link ReviewsResponse}: `{ summary, items, page, limit, total, totalPages }`.
 * Bundling the summary with the page lets the lightweight useApiQuery layer
 * (which drops the envelope `meta`) drive both the summary and the list from a
 * single request. Submission/edit/delete are deferred to Section 20.
 */
export function TripReviews({ subjectType, subjectId }: ReviewsSectionProps) {
  const t = useTranslations('reviews')
  const [sort, setSort] = useState<ReviewSort>('recent')
  const [minRating, setMinRating] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  // Accumulate pages so "show more" appends rather than replaces.
  const [loaded, setLoaded] = useState<Review[]>([])

  // A stable key for the current filter set; changing it resets pagination.
  const filterKey = `${sort}:${minRating}`

  const path = `/v1/reviews${buildQuery({
    type: subjectType,
    id: subjectId,
    sort,
    minRating: minRating > 0 ? minRating : undefined,
    page,
    limit: PAGE_SIZE,
  })}`

  const { data, isLoading, error, refetch } = useApiQuery<ReviewsResponse>(path)

  // Merge the freshly fetched page into the accumulated list. Page 1 (after a
  // filter/sort change) replaces; later pages append (de-duped by id).
  const [seenKey, setSeenKey] = useState(filterKey)
  const [seenPage, setSeenPage] = useState(0)
  if (data && (data.page !== seenPage || filterKey !== seenKey)) {
    setSeenKey(filterKey)
    setSeenPage(data.page)
    setLoaded((prev) => {
      const base = data.page <= 1 ? [] : prev
      const byId = new Map(base.map((r) => [r.id, r]))
      for (const r of data.items) byId.set(r.id, r)
      return [...byId.values()]
    })
  }

  const onSortChange = (next: ReviewSort) => {
    setSort(next)
    setPage(1)
  }
  const onFilterChange = (next: number) => {
    setMinRating(next)
    setPage(1)
  }

  // After an edit/delete, reset pagination and accumulation so the freshly
  // invalidated first page repopulates the list cleanly.
  const onReviewChanged = () => {
    setLoaded([])
    setSeenPage(0)
    setPage(1)
    refetch()
  }

  const summary = data?.summary
  const total = data?.total ?? 0
  const hasMore = useMemo(() => (data ? loaded.length < data.total : false), [data, loaded.length])

  // Initial load (no data yet) — show skeletons.
  if (isLoading && loaded.length === 0 && !error) {
    return (
      <section className="space-y-3" aria-busy="true">
        <h2 className="font-display text-lg font-semibold text-foreground">{t('title')}</h2>
        <ReviewsSkeleton />
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">{t('title')}</h2>
        <EmptyState
          icon={MessageSquare}
          title={t('error.title')}
          description={t('error.desc')}
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              {t('error.retry')}
            </Button>
          }
        />
      </section>
    )
  }

  const isEmpty = total === 0 && loaded.length === 0

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">{t('title')}</h2>
      </div>

      {summary && summary.reviewCount > 0 ? <ReviewSummaryCard summary={summary} /> : null}

      {isEmpty ? (
        <EmptyState icon={MessageSquare} title={t('empty.title')} description={t('empty.desc')} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">{t('sortLabel')}</span>
              <Select
                className="h-9 w-44 sm:h-9"
                aria-label={t('sortLabel')}
                value={sort}
                onChange={(e) => onSortChange(e.target.value as ReviewSort)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`sort.${opt}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">{t('filterLabel')}</span>
              <Select
                className="h-9 w-36 sm:h-9"
                aria-label={t('filterLabel')}
                value={String(minRating)}
                onChange={(e) => onFilterChange(Number(e.target.value))}
              >
                {RATING_FILTERS.map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? t('filter.all') : t('filter.stars', { n: r })}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {loaded.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t('emptyFiltered.title')}
              description={t('emptyFiltered.desc')}
            />
          ) : (
            <div className="space-y-4">
              {loaded.map((review) => (
                <ReviewItem
                  key={review.id}
                  review={review}
                  subjectType={subjectType}
                  subjectId={subjectId}
                  onChanged={onReviewChanged}
                />
              ))}
            </div>
          )}

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoading ? t('loadingMore') : t('showMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
