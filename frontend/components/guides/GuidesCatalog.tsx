'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { GuideCard } from './GuideCard'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { useTranslations } from '@/lib/i18n'
import {
  GUIDE_SORTS,
  GUIDE_LANGUAGES,
  GUIDE_SPECIALTIES,
  GUIDE_GENDERS,
  CAMBODIA_LOCATIONS,
  type GuideSort,
  type GuideSummary,
} from '@/types/catalog'
import type { Paginated } from '@/types/api'

const LIMIT = 12

export function GuidesCatalog() {
  const t = useTranslations('guides')
  const [language, setLanguage] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [location, setLocation] = useState('')
  const [gender, setGender] = useState('')
  const [verified, setVerified] = useState(false)
  const [sort, setSort] = useState<GuideSort>('recommended')
  const [page, setPage] = useState(1)

  const path = `/v1/guides${buildQuery({
    language: language || undefined,
    specialty: specialty || undefined,
    location: location || undefined,
    gender: gender || undefined,
    isVerified: verified || undefined,
    sort,
    page,
    limit: LIMIT,
  })}`
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<GuideSummary>>(path)

  function reset() {
    setLanguage('')
    setSpecialty('')
    setLocation('')
    setGender('')
    setVerified(false)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={language}
          onChange={(e) => {
            setPage(1)
            setLanguage(e.target.value)
          }}
          aria-label={t('filters.language')}
          className="w-auto min-w-28"
        >
          <option value="">{t('filters.anyLanguage')}</option>
          {GUIDE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          value={specialty}
          onChange={(e) => {
            setPage(1)
            setSpecialty(e.target.value)
          }}
          aria-label={t('filters.specialty')}
          className="w-auto min-w-32"
        >
          <option value="">{t('filters.anySpecialty')}</option>
          {GUIDE_SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={location}
          onChange={(e) => {
            setPage(1)
            setLocation(e.target.value)
          }}
          aria-label={t('filters.location')}
          className="w-auto min-w-32"
        >
          <option value="">{t('filters.anyLocation')}</option>
          {CAMBODIA_LOCATIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          value={gender}
          onChange={(e) => {
            setPage(1)
            setGender(e.target.value)
          }}
          aria-label={t('filters.gender')}
          className="w-auto min-w-28"
        >
          <option value="">{t('filters.anyGender')}</option>
          {GUIDE_GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => {
            setPage(1)
            setSort(e.target.value as GuideSort)
          }}
          aria-label={t('filters.sort')}
          className="ml-auto w-auto min-w-36"
        >
          {GUIDE_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sort.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Switch
          checked={verified}
          onCheckedChange={(v) => {
            setPage(1)
            setVerified(v)
          }}
          aria-label={t('filters.verifiedOnly')}
        />
        {t('filters.verifiedOnly')}
      </label>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title={t('error.title')}
          description={t('error.desc')}
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              {t('error.retry')}
            </Button>
          }
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            <Button variant="outline" size="sm" onClick={reset}>
              {t('empty.clear')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.items.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
          {data.totalPages > 1 ? (
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  )
}
