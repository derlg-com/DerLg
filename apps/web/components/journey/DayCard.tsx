'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/Button';
import { useTranslations } from '@/lib/i18n';
import { cn, formatCents } from '@/lib/utils';
import type { ItemType } from '@/types/catalog';
import type { DraftAvailabilityItem, DraftDay, DraftItem } from '@/types/journey';

const TYPE_LABEL: Record<ItemType, string> = {
  PLACE: 'Visit',
  HOTEL: 'Stay',
  TRANSPORT: 'Travel',
  GUIDE: 'Guide',
  CUSTOM: 'Free time',
};

interface DayCardProps {
  day: DraftDay;
  dayCount: number;
  availabilityByItem: Map<string, DraftAvailabilityItem>;
  onMoveDay: (direction: -1 | 1) => void;
  onRemoveDay: () => void;
  onRenameDay: (title: string) => void;
  onRemoveItem: (item: DraftItem) => void;
  onSwapItem: (item: DraftItem) => void;
  onAddItem: (type: ItemType) => void;
  onUseAlternative: (item: DraftItem, alternative: { refId: string; label: string }) => void;
}

export function DayCard({
  day,
  dayCount,
  availabilityByItem,
  onMoveDay,
  onRemoveDay,
  onRenameDay,
  onRemoveItem,
  onSwapItem,
  onAddItem,
  onUseAlternative,
}: DayCardProps) {
  const t = useTranslations('customize');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: day.dayKey,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-white p-4',
        isDragging ? 'border-brand-500 shadow-lg' : 'border-ink-200',
      )}
      data-testid={`day-${day.dayNumber}`}
    >
      <header className="flex items-start gap-2">
        {/*
          dnd-kit supplies role="button", tabIndex and aria-roledescription via
          `attributes`, so this is a span rather than a <button>: a native button
          turns Space into a click, which swallows the keyboard sensor's
          space-to-lift gesture.
        */}
        <span
          {...attributes}
          {...listeners}
          aria-label={t('dragHandle', { number: day.dayNumber })}
          className="mt-0.5 cursor-grab rounded px-1.5 py-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 active:cursor-grabbing"
        >
          <span aria-hidden="true">⠿</span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t('dayLabel', { number: day.dayNumber })}
          </p>
          <input
            value={day.title}
            aria-label={t('dayTitlePlaceholder')}
            placeholder={t('dayTitlePlaceholder')}
            onChange={(event) => onRenameDay(event.target.value)}
            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold text-ink-900 hover:border-ink-200 focus:border-ink-300"
          />
          {day.summary ? <p className="px-1 text-sm text-ink-600">{day.summary}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveDay(-1)}
            disabled={day.dayNumber === 1}
            aria-label={t('moveDayUp')}
            className="rounded p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            onClick={() => onMoveDay(1)}
            disabled={day.dayNumber === dayCount}
            aria-label={t('moveDayDown')}
            className="rounded p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            onClick={onRemoveDay}
            disabled={dayCount === 1}
            aria-label={t('removeDay')}
            className="rounded p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </header>

      {day.items.length === 0 ? (
        <p className="px-1 text-sm text-ink-500">{t('emptyDay')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-100">
          {day.items.map((item) => {
            const availability = availabilityByItem.get(item.itemKey);
            const unavailable = availability?.available === false;

            return (
              <li key={item.itemKey} className="flex flex-col gap-1 py-2.5">
                <div className="flex items-start gap-3">
                  <span className="w-12 shrink-0 text-sm tabular-nums text-ink-500">
                    {item.startTime ?? '—'}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium text-ink-900">{item.title}</span>
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                        {TYPE_LABEL[item.type]}
                      </span>
                      {item.unitPriceCents > 0 ? (
                        <span className="text-xs text-ink-500">
                          {formatCents(item.unitPriceCents)}
                        </span>
                      ) : null}
                    </span>
                    {item.referenceLabel && item.referenceLabel !== item.title ? (
                      <span className="text-xs text-ink-500">{item.referenceLabel}</span>
                    ) : null}
                    {!item.bookable ? (
                      <span className="text-xs italic text-ink-500">{t('freeTimeNote')}</span>
                    ) : null}

                    {unavailable ? (
                      <div className="mt-1 flex flex-col gap-1 rounded-lg bg-amber-50 p-2">
                        <span className="text-xs font-medium text-amber-800" role="alert">
                          {t('unavailableItem', { date: availability?.date ?? '' })}
                        </span>
                        {(availability?.alternatives.length ?? 0) > 0 ? (
                          <>
                            <span className="text-xs text-amber-800">{t('alternativesLabel')}</span>
                            <div className="flex flex-wrap gap-1">
                              {availability?.alternatives.map((alternative) => (
                                <button
                                  key={alternative.refId}
                                  type="button"
                                  onClick={() => onUseAlternative(item, alternative)}
                                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
                                >
                                  {alternative.label} · {formatCents(alternative.priceCents)}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {item.bookable ? (
                      <button
                        type="button"
                        onClick={() => onSwapItem(item)}
                        className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        {t('swapItem')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item)}
                      aria-label={t('removeItem', { title: item.title })}
                      className="rounded px-2 py-1 text-xs text-ink-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
        <Button variant="ghost" size="sm" onClick={() => onAddItem('PLACE')}>
          {t('addPlace')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAddItem('HOTEL')}>
          {t('addHotel')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAddItem('TRANSPORT')}>
          {t('addTransport')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAddItem('GUIDE')}>
          {t('addGuide')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAddItem('CUSTOM')}>
          {t('addFreeTime')}
        </Button>
      </div>
    </li>
  );
}
