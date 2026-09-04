'use client'

import { Building, CalendarDays, CheckCircle2, Compass, Map as MapIcon, Users } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { DirectionsLink, GoogleMapsLink } from '@/components/chat/maps-links'
import { GalleryRail } from '@/components/chat/payloads/lightbox'
import { Price } from '@/components/shared/price'
import { Badge, Button, Skeleton, buttonVariants } from '@/components/ui'
import { useCountdown } from '@/hooks/use-countdown'
import type { PaymentState } from '@/hooks/use-payment-status'
import type { MapMarker } from '@/components/map/leaflet-map'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import {
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  googleMapsRouteUrl,
} from '@/lib/maps/google'
import { normalizeImageUrl, safeImageSrc } from '@/lib/url-safety'
import { workspacePoints, type WorkspaceState } from '@/lib/vibe/workspace'

/**
 * The workspace panel — the "dynamic UI area" of spec §19.
 *
 * A chat transcript is a log: everything scrolls away, including the things that
 * matter most. This panel is the opposite — a live view of the conversation's
 * STATE (selected trip, its map, the active hold and payment) that stays put while
 * the conversation moves.
 *
 * It deliberately does NOT duplicate the transcript. Cards, comparisons, weather
 * and budgets stay inline where they were said; only the durable things the spec
 * asks the system to remember are pinned here.
 *
 * One tree, two presentations: a sticky rail from `lg` up, and the same tree inside
 * a bottom sheet below it. Because BOTH are mounted at once (the rail is hidden by
 * CSS, not unmounted), this component owns no side effects — the payment watch
 * lives in ChatView and its result is passed in.
 */

const LeafletMap = dynamic(
  () => import('@/components/map/leaflet-map').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-40 w-full rounded-[var(--radius-md)]" />,
  },
)

export interface WorkspacePanelProps {
  state: WorkspaceState
  /** Sends a follow-up message on the user's behalf. */
  onAsk: (text: string) => void
  /** Notifies the agent a payment finished; the agent re-checks before acting. */
  onPaymentCompleted?: (bookingId: string) => void
  isAuthenticated?: boolean
  /** Latest status seen by ChatView's single payment watcher. */
  polledStatus?: PaymentState
  polledAmountUsd?: number
  selectedProductId?: string | null
  onSelectProduct?: (id: string | null) => void
}

export function WorkspacePanel(props: WorkspacePanelProps) {
  return <WorkspacePanelInner {...props} />
}

/**
 * Memoised so a streaming reply does not re-render the workspace.
 *
 * ChatView re-renders on every stream chunk. Without this the whole panel —
 * including the Leaflet map and two countdown timers — would re-render dozens of
 * times per reply for no change in what it shows. The props are memoised on the
 * ChatView side so this comparison actually succeeds.
 */
const WorkspacePanelInner = React.memo(function WorkspacePanelInner({
  state,
  onAsk,
  onPaymentCompleted,
  isAuthenticated,
  polledStatus,
  polledAmountUsd,
  selectedProductId,
  onSelectProduct,
}: WorkspacePanelProps) {
  const t = useTranslations('workspace')

  if (!state.hasContent) return <WorkspaceEmpty />

  return (
    <div className="flex flex-col gap-3" data-testid="workspace-panel">
      {/* Ordered by urgency: a confirmed booking, then money, then the trip. */}
      {state.confirmation ? <ConfirmationSection state={state} /> : null}
      {state.payment ? (
        <PaymentSection
          state={state}
          onAsk={onAsk}
          onPaymentCompleted={onPaymentCompleted}
          isAuthenticated={isAuthenticated}
          polledStatus={polledStatus}
          polledAmountUsd={polledAmountUsd}
        />
      ) : null}
      {state.hold ? <HoldSection state={state} onAsk={onAsk} /> : null}
      {state.subject ? <SubjectSection state={state} onAsk={onAsk} /> : null}
      {state.map ? (
        <MapSection
          state={state}
          selectedProductId={selectedProductId}
          onSelectProduct={onSelectProduct}
        />
      ) : null}
      {state.itinerary ? <ItinerarySection state={state} /> : null}
      {state.gallery ? <GallerySection state={state} /> : null}
      {state.options && !state.subject ? <OptionsHint state={state} onAsk={onAsk} /> : null}

      <p className="px-1 text-xs text-[var(--text-tertiary)]">{t('footnote')}</p>
    </div>
  )
})

function WorkspaceEmpty() {
  const t = useTranslations('workspace')

  return (
    <div
      /*
       * Same test id as the populated panel. A hook that vanishes in the empty
       * state makes "is the workspace empty?" unassertable — which is the one
       * question about an empty panel worth asking.
       */
      data-testid="workspace-panel"
      data-workspace-empty="true"
      className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] p-6 text-center"
    >
      <MapIcon aria-hidden="true" className="size-5 text-[var(--text-tertiary)]" />
      <p className="text-sm font-medium text-[var(--text-secondary)]">{t('emptyTitle')}</p>
      <p className="text-xs text-[var(--text-tertiary)]">{t('emptyDesc')}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ sections */

function Section({
  title,
  tone = 'neutral',
  action,
  children,
}: {
  title: string
  tone?: 'neutral' | 'warning' | 'success'
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-[var(--border-default)] bg-[var(--tone-warning-bg)]'
      : tone === 'success'
        ? 'border-[var(--border-default)] bg-[var(--tone-success-bg)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface)]'

  return (
    <section className={cn('rounded-[var(--radius-lg)] border p-3', toneClass)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function WorkspaceHeroImage({
  src,
  alt,
  kind,
}: {
  src?: string
  alt: string
  kind: 'trip' | 'hotel' | 'custom_trip'
}) {
  const [hasError, setHasError] = React.useState(false)
  const [isLoaded, setIsLoaded] = React.useState(false)
  const safe = normalizeImageUrl(src)
  if (!safe) return null

  if (hasError) {
    return (
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--surface-sunken)] to-[var(--surface)] flex flex-col items-center justify-center p-3 text-center border border-[var(--border-subtle)]">
        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--surface)] shadow-xs">
          {kind === 'hotel' ? (
            <Building className="size-5 text-[var(--accent)]" />
          ) : (
            <Compass className="size-5 text-[var(--accent)]" />
          )}
        </div>
        <span className="mt-2 text-xs font-medium text-[var(--text-secondary)] line-clamp-1 max-w-[85%]">
          {alt}
        </span>
      </div>
    )
  }

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)]">
      {!isLoaded ? (
        <div className="absolute inset-0 animate-pulse bg-[var(--surface-sunken)]" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={safe}
        alt={alt}
        className={cn(
          'size-full object-cover transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}

function SubjectSection({ state, onAsk }: { state: WorkspaceState; onAsk: (text: string) => void }) {
  const t = useTranslations('workspace')
  const tContent = useTranslations('content')
  const subject = state.subject
  if (!subject) return null

  const mapsUrl = googleMapsPlaceUrl({ lat: subject.lat, lng: subject.lng }, subject.name)

  return (
    <Section title={t(`subject.${subject.kind}`)}>
      <div className="flex flex-col gap-2">
        <WorkspaceHeroImage
          src={subject.imageUrl}
          alt={subject.name}
          kind={subject.kind}
        />

        <p className="text-sm font-semibold text-[var(--text-primary)]">{subject.name}</p>

        <p className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={subject.priceUsd} />
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {tContent(subject.priceUnit === 'total' ? 'customTripTotal' : subject.priceUnit)}
          </span>
          {subject.durationDays !== undefined ? (
            <span className="text-xs text-[var(--text-tertiary)]">· {subject.durationDays}d</span>
          ) : null}
          {subject.rating !== undefined ? (
            <span className="text-xs text-[var(--text-tertiary)]">
              · ★ {subject.rating.toFixed(1)}
            </span>
          ) : null}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => onAsk(t('askBook', { name: subject.name }))}>
            {tContent('bookNow')}
          </Button>
          {mapsUrl ? <GoogleMapsLink href={mapsUrl} /> : null}
          {subject.href ? (
            <Link
              href={subject.href}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              {tContent('viewDetails')}
            </Link>
          ) : null}
        </div>
      </div>
    </Section>
  )
}

function MapSection({
  state,
  selectedProductId,
  onSelectProduct,
}: {
  state: WorkspaceState
  selectedProductId?: string | null
  onSelectProduct?: (id: string | null) => void
}) {
  const t = useTranslations('workspace')
  const tExplore = useTranslations('explore')
  const map = state.map

  /*
   * Memoised on the marker DATA, not recreated per render.
   *
   * LeafletMap's marker effect depends on this array's identity and, when it
   * changes, clears every layer, rebuilds it and re-runs `fitBounds`. A fresh
   * array each render would therefore tear the map down and re-fit it on every
   * streamed token — visible jitter, and a lot of wasted work mid-reply.
   */
  const markers = React.useMemo<MapMarker[]>(
    () =>
      (map?.markers ?? []).map((marker, index) => ({
        id: marker.id || `marker-${index}`,
        latitude: marker.lat,
        longitude: marker.lng,
        // A pin with no label is unusable for keyboard and screen-reader users.
        label: marker.label ?? `${index + 1}`,
        kind: marker.type === 'trip' || marker.type === 'hotel' ? marker.type : 'place',
      })),
    [map?.markers],
  )

  if (!map) return null

  const points = workspacePoints(state)
  const routeUrl = googleMapsRouteUrl(points)
  const directionsUrl = googleMapsDirectionsUrl(points[0] ?? null, {
    destinationName: state.subject?.name,
  })

  return (
    <Section title={t('mapTitle')}>
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
          <LeafletMap
            markers={markers}
            selectedId={selectedProductId}
            onSelect={(id) => onSelectProduct?.(id)}
            className="h-40 w-full"
            ariaLabel={tExplore('map.mapLabel')}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {routeUrl ? <GoogleMapsLink href={routeUrl} /> : null}
          {directionsUrl ? <DirectionsLink href={directionsUrl} /> : null}
        </div>
      </div>
    </Section>
  )
}

function ItinerarySection({ state }: { state: WorkspaceState }) {
  const t = useTranslations('workspace')
  const tCatalog = useTranslations('catalog')
  const itinerary = state.itinerary
  if (!itinerary) return null

  return (
    <Section title={t('itineraryTitle')}>
      <ol className="flex flex-col gap-1.5">
        {itinerary.days.map((day) => (
          <li key={day.day} className="text-sm">
            <span className="font-medium text-[var(--accent-subtle-text)]">
              {tCatalog('detail.day', { number: day.day })}
            </span>
            <span className="text-[var(--text-secondary)]"> — {day.title}</span>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function GallerySection({ state }: { state: WorkspaceState }) {
  const t = useTranslations('workspace')
  const tContent = useTranslations('content')
  const gallery = state.gallery
  if (!gallery) return null

  return (
    <Section title={t('galleryTitle')}>
      <GalleryRail
        images={gallery.images}
        title={tContent('gallery')}
        className="sm:grid-cols-3"
        thumbClassName="w-24 sm:w-auto"
      />
    </Section>
  )
}

function HoldSection({ state, onAsk }: { state: WorkspaceState; onAsk: (text: string) => void }) {
  const t = useTranslations('workspace')
  const tBooking = useTranslations('booking')
  const tCheckout = useTranslations('checkout')
  const hold = state.hold
  const countdown = useCountdown(hold?.holdExpiresAt)
  if (!hold) return null

  const expired = countdown?.expired ?? false
  /*
   * The hold stops nagging only once THIS booking's payment has landed.
   *
   * Keyed on the booking id, not merely on "a payment succeeded somewhere in the
   * conversation": a confirmation for an earlier booking would otherwise hide a
   * live hold's countdown and its Pay button, stranding the user on the booking
   * they are actually trying to pay for.
   */
  const superseded =
    state.payment?.status === 'SUCCEEDED' && state.payment.bookingId === hold.bookingId

  return (
    <Section
      title={tBooking('summary')}
      tone={expired && !superseded ? 'warning' : 'neutral'}
      action={superseded ? null : <Countdown expiresAt={hold.holdExpiresAt} />}
    >
      <div className="flex flex-col gap-2">
        {hold.itemName ? (
          <p className="text-sm font-medium text-[var(--text-primary)]">{hold.itemName}</p>
        ) : null}

        <dl className="flex flex-col gap-1">
          {hold.travelDate ? (
            <FactRow
              icon={<CalendarDays aria-hidden="true" className="size-3.5" />}
              label={tBooking('travelDate')}
              value={formatDate(hold.travelDate)}
            />
          ) : null}
          <FactRow
            icon={<Users aria-hidden="true" className="size-3.5" />}
            label={tBooking('travellers', { count: hold.peopleCount })}
            value={String(hold.peopleCount)}
          />
        </dl>

        <div className="flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{tCheckout('total')}</p>
          <p className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={hold.totalUsd} />
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {superseded ? null : (
            <Button
              size="sm"
              // An expired hold cannot be confirmed server-side, so do not offer it.
              disabled={expired}
              onClick={() => onAsk(t('askPay', { name: hold.itemName || tBooking('summary') }))}
            >
              {expired ? tBooking('expired') : t('payNow')}
            </Button>
          )}
          <Link
            href={`/bookings/${hold.bookingId}`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            {tCheckout('confirmation.viewBooking')}
          </Link>
        </div>
      </div>
    </Section>
  )
}

/**
 * Payment section.
 *
 * Starts no poll and sends no notification of its own, because this component is
 * mounted TWICE (hidden desktop rail + mobile sheet) and a network side effect
 * here would run twice for one payment. `polledStatus` arrives from ChatView's
 * single watcher; the only local effect is the claim button's own lockout timer.
 */
function PaymentSection({
  state,
  polledStatus,
  polledAmountUsd,
  onAsk,
  onPaymentCompleted,
  isAuthenticated,
}: {
  state: WorkspaceState
  polledStatus?: PaymentState
  polledAmountUsd?: number
  onAsk: (text: string) => void
  onPaymentCompleted?: (bookingId: string) => void
  isAuthenticated?: boolean
}) {
  const t = useTranslations('workspace')
  const tBooking = useTranslations('booking')
  const tCheckout = useTranslations('checkout')
  const tStatus = useTranslations('paymentStatus')

  const payment = state.payment
  const countdown = useCountdown(payment?.expiry)
  const [claiming, setClaiming] = React.useState(false)

  /*
   * Re-enable the claim after a beat.
   *
   * The agent may answer "payment not confirmed yet", which changes no status and
   * would otherwise leave the button disabled for the life of the mount — a dead
   * end with no second attempt. A short lockout is enough to absorb the double
   * click it exists to prevent without stranding anyone. Local UI state only: this
   * starts no request, so it stays harmless in the two mounted copies of the panel.
   */
  React.useEffect(() => {
    if (!claiming) return
    const timer = setTimeout(() => setClaiming(false), 8000)
    return () => clearTimeout(timer)
  }, [claiming])

  if (!payment) return null

  const codeExpired = countdown?.expired ?? false
  const bookingId = payment.bookingId
  const qrSrc = safeImageSrc(payment.qrUrl)
  /*
   * The agent's own status wins when it has one: it is derived from the booking
   * record the agent itself re-read. Polling only fills the gap before that.
   */
  const status = payment.status ?? polledStatus ?? 'PENDING'
  const settled = status !== 'PENDING'

  const tone = status === 'SUCCEEDED' ? 'success' : status === 'FAILED' ? 'warning' : 'neutral'
  const statusLabel = tStatus(
    status === 'SUCCEEDED'
      ? 'succeeded'
      : status === 'FAILED'
        ? 'failed'
        : status === 'CANCELLED'
          ? 'cancelled'
          : 'pending',
  )

  return (
    <Section
      title={tCheckout('title')}
      tone={tone}
      action={
        <Badge
          tone={status === 'SUCCEEDED' ? 'success' : status === 'FAILED' ? 'danger' : 'warning'}
        >
          {statusLabel}
        </Badge>
      }
    >
      <div className="flex flex-col gap-2">
        {/* The code is only useful while unpaid and unexpired — hide it otherwise. */}
        {qrSrc && !settled && !codeExpired ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="size-36 overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt={tBooking('scanQr')}
                className="size-full object-contain"
                decoding="async"
              />
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{tCheckout('qr.scan')}</p>
            <Countdown expiresAt={payment.expiry} />
          </div>
        ) : null}

        <p className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-[var(--text-secondary)]">{tCheckout('total')}</span>
          <span className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={polledAmountUsd ?? payment.amountUsd} />
          </span>
        </p>

        {status === 'PENDING' && !codeExpired ? (
          <p
            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"
            role="status"
          >
            <span
              className="size-1.5 animate-pulse rounded-full bg-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            {t('watchingPayment')}
          </p>
        ) : null}

        {status === 'SUCCEEDED' ? (
          <p
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--tone-success-text)]"
            role="status"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {tBooking('paymentSuccess')}
          </p>
        ) : null}

        {codeExpired && !settled ? (
          <p className="text-xs text-[var(--tone-danger-text)]">{tBooking('qrExpiredDesc')}</p>
        ) : null}

        {/*
         * A manual claim remains as a fallback for when polling cannot see the
         * payment. It asserts nothing: the agent re-reads the booking's payment
         * record before acting, and refuses anything it cannot confirm. Disabled
         * after one press — the round-trip is slow enough to invite a second
         * click, and each one costs an agent turn.
         */}
        {!settled && bookingId && isAuthenticated === true ? (
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            disabled={claiming}
            onClick={() => {
              setClaiming(true)
              onPaymentCompleted?.(bookingId)
            }}
          >
            {claiming ? t('watchingPayment') : tCheckout('qr.paid')}
          </Button>
        ) : null}

        {!settled && bookingId && isAuthenticated !== true ? (
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}
          >
            {tBooking('signInToPay')}
          </Link>
        ) : null}

        {status === 'FAILED' ? (
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() => onAsk(t('askRetryPayment'))}
          >
            {tStatus('retry')}
          </Button>
        ) : null}
      </div>
    </Section>
  )
}

function ConfirmationSection({ state }: { state: WorkspaceState }) {
  const t = useTranslations('booking')
  const tCheckout = useTranslations('checkout')
  const confirmation = state.confirmation
  if (!confirmation) return null

  return (
    <Section title={t('bookingConfirmed')} tone="success">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[var(--tone-success-text)]" role="status">
          {confirmation.tripName}
        </p>
        <dl className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--tone-success-text)]">{t('reference')}</dt>
            <dd className="font-mono text-sm text-[var(--tone-success-text)]">
              {confirmation.bookingRef}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--tone-success-text)]">{t('travelDate')}</dt>
            <dd className="text-sm text-[var(--tone-success-text)]">
              {formatDate(confirmation.travelDate)}
            </dd>
          </div>
        </dl>
        <Link
          href={`/bookings/${confirmation.bookingRef}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}
        >
          {tCheckout('confirmation.viewBooking')}
        </Link>
      </div>
    </Section>
  )
}

/** Nudge back to the options when nothing specific is selected yet. */
function OptionsHint({ state, onAsk }: { state: WorkspaceState; onAsk: (text: string) => void }) {
  const t = useTranslations('workspace')
  const options = state.options
  if (!options) return null

  return (
    <Section title={t('optionsTitle')}>
      <p className="text-sm text-[var(--text-secondary)]">
        {t(`optionsCount.${options.kind}`, { count: options.count })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => onAsk(t('askCompare'))}>
          {t('compare')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAsk(t('askCheapest'))}>
          {t('cheapest')}
        </Button>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------- atoms */

/**
 * Remaining time on a hold or a payment code.
 *
 * Deliberately NOT a live region. The value changes every second, so a polite
 * live region makes a screen reader recite the countdown continuously and drown
 * out everything else. The number is decoration over the real signal — expiry —
 * which the surrounding component announces once, when it happens.
 */
function Countdown({ expiresAt }: { expiresAt: string | undefined }) {
  const t = useTranslations('booking')
  const countdown = useCountdown(expiresAt)

  if (!countdown) return null

  if (countdown.expired) {
    return (
      <span className="text-xs font-medium text-[var(--tone-danger-text)]" role="status">
        {t('expired')}
      </span>
    )
  }

  return (
    <span className="text-xs font-medium tabular-nums text-[var(--text-secondary)]">
      {t('expiresIn', { minutes: countdown.minutes, seconds: countdown.seconds })}
    </span>
  )
}

function FactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-[var(--text-secondary)]">{value}</dd>
    </div>
  )
}

/** Readable date, falling back to the raw value when it is not parseable. */
function formatDate(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
