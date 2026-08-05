import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';
import type { DayItem, PackageDay } from '@/types/catalog';

const TYPE_LABEL: Record<DayItem['type'], string> = {
  PLACE: 'Visit',
  HOTEL: 'Stay',
  TRANSPORT: 'Travel',
  GUIDE: 'Guide',
  CUSTOM: 'Free time',
};

function itemPriceLabel(item: DayItem, t: (key: string) => string): string | null {
  const reference = item.reference;
  if (!reference) {
    return null;
  }

  switch (reference.kind) {
    case 'PLACE':
      return reference.place.entranceFeeCents > 0
        ? formatCents(reference.place.entranceFeeCents)
        : t('entranceIncluded');
    case 'HOTEL':
      return `${formatCents(reference.hotel.pricePerNightCents)} ${t('nightStay')}`;
    case 'TRANSPORT':
      return `${formatCents(reference.transport.pricePerSeatCents)} ${t('seat')}`;
    case 'GUIDE':
      return `${formatCents(reference.guide.pricePerDayCents)} ${t('guideDay')}`;
    default:
      return null;
  }
}

/** Read-only day-by-day timeline shown on the package detail page. */
export function ItineraryTimeline({ days }: { days: PackageDay[] }) {
  const t = useTranslations('packageDetail');

  return (
    <ol className="flex flex-col gap-8">
      {days.map((day) => (
        <li key={day.id} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              {t('dayLabel', { number: day.dayNumber })}
            </p>
            <h3 className="text-lg font-semibold text-ink-900">{day.title}</h3>
            <p className="text-sm text-ink-600">{day.summary}</p>
          </div>

          <ul className="flex flex-col gap-2 border-l-2 border-ink-200 pl-4">
            {day.items.map((item) => {
              const price = itemPriceLabel(item, t);

              return (
                <li key={item.id} className="flex flex-col gap-0.5 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-ink-500">
                      {item.startTime ?? '—'}
                    </span>
                    <span className="text-sm font-medium text-ink-900">{item.title}</span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                      {TYPE_LABEL[item.type]}
                    </span>
                    {price ? <span className="text-xs text-ink-500">{price}</span> : null}
                  </div>

                  {item.description ? (
                    <p className="pl-[3.75rem] text-sm text-ink-600">{item.description}</p>
                  ) : null}

                  {!item.bookable ? (
                    <p className="pl-[3.75rem] text-xs italic text-ink-500">
                      {t('nonBookableNote')}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
