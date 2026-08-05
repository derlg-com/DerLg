'use client';

import Link from 'next/link';

import { HoldCountdown } from '@/components/bookings/HoldCountdown';
import { hasSchema, stagePayloadSchemas } from '@/schemas/vibe';
import type {
  AvailabilityPayload,
  BookingPayload,
  GuidesPayload,
  HotelsPayload,
  ItineraryPayload,
  PackagesPayload,
  PlacesPayload,
  TransportPayload,
} from '@/schemas/vibe';
import type { VibePanel } from '@/types/vibe';
import { formatCents } from '@/lib/utils';

/**
 * The right-hand screen: real inventory, rendered from the data the tools
 * returned rather than from the model's prose.
 *
 * Every payload is validated before use. A stage this build does not recognise,
 * or a payload whose shape has drifted, falls back to a plain summary — a
 * concierge that cannot draw a card is still better than a blank screen.
 */
export function ContentStagePanel({ panel }: { panel: VibePanel }): React.ReactElement {
  const { stage, payload } = panel;

  if (!hasSchema(stage)) {
    return <TextSummary stage={stage} payload={payload} />;
  }

  const parsed = stagePayloadSchemas[stage].safeParse(payload);
  if (!parsed.success) {
    return <TextSummary stage={stage} payload={payload} />;
  }

  switch (stage) {
    case 'places':
      return <PlacesCards data={parsed.data as PlacesPayload} />;
    case 'hotels':
      return <HotelCards data={parsed.data as HotelsPayload} />;
    case 'transport':
      return <TransportCards data={parsed.data as TransportPayload} />;
    case 'guides':
      return <GuideCards data={parsed.data as GuidesPayload} />;
    case 'packages':
      return <PackageCards data={parsed.data as PackagesPayload} />;
    case 'availability':
      return <AvailabilityCard data={parsed.data as AvailabilityPayload} />;
    case 'itinerary':
      return <ItineraryCard data={parsed.data as ItineraryPayload} />;
    case 'booking':
      return <BookingCard data={parsed.data as BookingPayload} />;
    default:
      return <TextSummary stage={stage} payload={payload} />;
  }
}

function PanelShell({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-label={title}
    >
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {count === undefined ? null : (
          <span className="text-xs text-stone-500">
            {count} {count === 1 ? 'option' : 'options'}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyRow({ what }: { what: string }): React.ReactElement {
  return <p className="text-sm text-stone-500">No {what} matched that search.</p>;
}

function PlacesCards({ data }: { data: PlacesPayload }): React.ReactElement {
  return (
    <PanelShell title="Places to visit" count={data.items.length}>
      {data.items.length === 0 ? (
        <EmptyRow what="places" />
      ) : (
        <ul className="space-y-2">
          {data.items.map((place) => (
            <li
              key={place.refId}
              className="flex items-start justify-between gap-3 rounded-lg bg-stone-50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{place.name}</p>
                <p className="text-xs text-stone-500">
                  {[place.city, place.category?.toLowerCase()].filter(Boolean).join(' · ')}
                  {place.visitMinutes ? ` · about ${Math.round(place.visitMinutes / 60)}h` : ''}
                </p>
              </div>
              <span className="whitespace-nowrap text-sm text-stone-700">
                {place.entranceFeeUsd ? formatCents(place.entranceFeeUsd * 100) : 'Free'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function HotelCards({ data }: { data: HotelsPayload }): React.ReactElement {
  return (
    <PanelShell title="Where to stay" count={data.items.length}>
      {data.items.length === 0 ? (
        <EmptyRow what="hotels" />
      ) : (
        <ul className="space-y-2">
          {data.items.map((hotel) => (
            <li key={hotel.refId} className="rounded-lg bg-stone-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{hotel.name}</p>
                  <p className="text-xs text-stone-500">
                    {[hotel.city, hotel.stars ? `${hotel.stars}-star` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {hotel.pricePerNightUsd === undefined ? null : (
                  <span className="whitespace-nowrap text-sm text-stone-700">
                    {formatCents(hotel.pricePerNightUsd * 100)}
                    <span className="text-xs text-stone-500"> / night</span>
                  </span>
                )}
              </div>
              {hotel.amenities?.length ? (
                <p className="mt-2 text-xs text-stone-500">{hotel.amenities.join(' · ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function TransportCards({ data }: { data: TransportPayload }): React.ReactElement {
  return (
    <PanelShell title="Getting around" count={data.items.length}>
      {data.items.length === 0 ? (
        <EmptyRow what="transport" />
      ) : (
        <ul className="space-y-2">
          {data.items.map((ride) => (
            <li
              key={ride.refId}
              className="flex items-start justify-between gap-3 rounded-lg bg-stone-50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{ride.operator}</p>
                <p className="text-xs text-stone-500">
                  {[
                    ride.from && ride.to ? `${ride.from} → ${ride.to}` : null,
                    ride.kind?.toLowerCase().replace('_', ' '),
                    ride.departureTime,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {ride.pricePerSeatUsd === undefined ? null : (
                <span className="whitespace-nowrap text-sm text-stone-700">
                  {formatCents(ride.pricePerSeatUsd * 100)}
                  <span className="text-xs text-stone-500"> / seat</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function GuideCards({ data }: { data: GuidesPayload }): React.ReactElement {
  return (
    <PanelShell title="Guides" count={data.items.length}>
      {data.items.length === 0 ? (
        <EmptyRow what="guides" />
      ) : (
        <ul className="space-y-2">
          {data.items.map((guide) => (
            <li
              key={guide.refId}
              className="flex items-start justify-between gap-3 rounded-lg bg-stone-50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{guide.name}</p>
                <p className="text-xs text-stone-500">
                  {[guide.languages?.join(', '), guide.city].filter(Boolean).join(' · ')}
                  {guide.yearsExperience ? ` · ${guide.yearsExperience} years` : ''}
                </p>
              </div>
              {guide.pricePerDayUsd === undefined ? null : (
                <span className="whitespace-nowrap text-sm text-stone-700">
                  {formatCents(guide.pricePerDayUsd * 100)}
                  <span className="text-xs text-stone-500"> / day</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function PackageCards({ data }: { data: PackagesPayload }): React.ReactElement {
  return (
    <PanelShell title="Ready-made trips" count={data.items.length}>
      {data.items.length === 0 ? (
        <EmptyRow what="trips" />
      ) : (
        <ul className="space-y-2">
          {data.items.map((pkg) => (
            <li key={pkg.packageId} className="rounded-lg bg-stone-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{pkg.title}</p>
                  <p className="text-xs text-stone-500">
                    {[pkg.city, pkg.days ? `${pkg.days} days` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {pkg.priceUsd === undefined ? null : (
                  <span className="whitespace-nowrap text-sm text-stone-700">
                    {formatCents(pkg.priceUsd * 100)}
                  </span>
                )}
              </div>
              {pkg.summary ? <p className="mt-2 text-xs text-stone-600">{pkg.summary}</p> : null}
              <Link
                href={`/packages/${pkg.slug}`}
                className="mt-2 inline-block text-xs font-medium text-amber-700 underline hover:text-amber-800"
              >
                See the full trip
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function AvailabilityCard({ data }: { data: AvailabilityPayload }): React.ReactElement {
  const unavailable = data.items.filter((item) => !item.available);

  return (
    <PanelShell title="Availability">
      <p
        className={`text-sm font-medium ${data.available ? 'text-emerald-700' : 'text-amber-700'}`}
      >
        {data.available
          ? 'Everything is available on these dates.'
          : 'Some things are not available on these dates.'}
      </p>
      {data.totalUsd === undefined ? null : (
        <p className="mt-1 text-sm text-stone-700">
          Total {formatCents(data.totalUsd * 100)}
        </p>
      )}
      {unavailable.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {unavailable.map((item) => (
            <li key={`${item.type}-${item.dayNumber}`} className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                Day {item.dayNumber} · {item.type.toLowerCase()}
                {item.reason ? ` · ${item.reason.replace(/_/g, ' ').toLowerCase()}` : ''}
              </p>
              {item.alternatives?.length ? (
                <p className="mt-1 text-xs text-amber-800">
                  Instead: {item.alternatives.map((alt) => alt.name).join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </PanelShell>
  );
}

function ItineraryCard({ data }: { data: ItineraryPayload }): React.ReactElement {
  return (
    <section
      className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm"
      aria-label="Your itinerary"
    >
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-stone-900">{data.title}</h3>
        <p className="text-xs text-stone-600">
          {[
            data.startDate ? `From ${data.startDate}` : null,
            `${data.guests} ${data.guests === 1 ? 'traveller' : 'travellers'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <ol className="space-y-3">
        {data.days.map((day) => (
          <li key={day.dayNumber} className="rounded-lg bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Day {day.dayNumber}
            </p>
            <p className="text-sm font-medium text-stone-900">{day.title}</p>
            {day.summary ? <p className="text-xs text-stone-600">{day.summary}</p> : null}
            <ul className="mt-2 space-y-1">
              {day.items.map((item, index) => (
                <li
                  key={`${item.refId ?? 'custom'}-${index}`}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-stone-700">
                    {item.startTime ? <span className="text-stone-500">{item.startTime} </span> : null}
                    {item.name ?? item.title}
                    {item.bookable ? null : (
                      <span className="text-stone-500"> — free time, nothing booked</span>
                    )}
                  </span>
                  {item.bookable && item.unitPriceUsd ? (
                    <span className="whitespace-nowrap text-stone-600">
                      {formatCents(item.unitPriceUsd * 100)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <footer className="mt-4 border-t border-amber-200 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-stone-900">Total</span>
          <span className="text-lg font-semibold text-stone-900" data-testid="vibe-itinerary-total">
            {formatCents(data.totalUsd * 100)}
          </span>
        </div>
        {data.availability && !data.availability.available ? (
          <p className="mt-2 text-xs text-amber-800">
            Some items need changing before this can be booked.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* The handoff to the manual editor (Task 18) — same draft, full control. */}
          <Link
            href={`/journeys/${data.draftId}`}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50"
          >
            Edit this trip myself
          </Link>
          <Link
            href={`/checkout/new?draft=${data.draftId}`}
            className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-800"
          >
            Hold and pay
          </Link>
        </div>
      </footer>
    </section>
  );
}

function BookingCard({ data }: { data: BookingPayload }): React.ReactElement {
  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm"
      aria-label="Your booking"
    >
      <h3 className="text-sm font-semibold text-stone-900">Held for you</h3>
      <p className="mt-1 font-mono text-sm text-stone-800">{data.reference}</p>
      <p className="mt-2 text-lg font-semibold text-stone-900">
        {formatCents(data.totalUsd * 100)}
      </p>

      {data.secondsRemaining === null || data.secondsRemaining === undefined ? null : (
        <div className="mt-3">
          <HoldCountdown seconds={data.secondsRemaining ?? null} />
        </div>
      )}

      <p className="mt-3 text-xs text-stone-600">
        Nothing has been charged yet. Your seats are reserved until the timer runs out.
      </p>

      {/* Built here from bookingId: the API deliberately sends no URL, because the
          model turned one into an invented domain. */}
      <Link
        href={`/checkout/${data.bookingId}`}
        className="mt-3 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        Pay now
      </Link>
    </section>
  );
}

/** Last resort: say what was found without pretending to draw it. */
function TextSummary({ stage, payload }: { stage: string; payload: unknown }): React.ReactElement {
  const count =
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items.length
      : null;

  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700"
      aria-label="Result"
    >
      <p className="font-medium text-stone-900">{stage.replace(/_/g, ' ')}</p>
      <p className="mt-1 text-stone-600">
        {count === null
          ? 'The concierge found something for you — see the message beside this panel.'
          : `${count} ${count === 1 ? 'result' : 'results'} — see the message beside this panel.`}
      </p>
    </section>
  );
}
