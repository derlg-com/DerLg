'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';

import { DayCard } from '@/components/journey/DayCard';
import { JourneyPricePanel } from '@/components/journey/JourneyPricePanel';
import { ResourcePicker } from '@/components/journey/ResourcePicker';
import { Button } from '@/components/ui/Button';
import { useDraftAutosave } from '@/hooks/use-journey-draft';
import { ApiError } from '@/lib/api-client';
import { useTranslations } from '@/lib/i18n';
import type { ItemType } from '@/types/catalog';
import type { DraftItem, DraftItemInput, DraftView } from '@/types/journey';

type PickerState =
  | { mode: 'add'; type: ItemType; dayKey: string }
  | { mode: 'swap'; type: ItemType; itemKey: string }
  | null;

/**
 * The journey editor. Every mutation is expressed as a named operation and sent
 * to the server, which revalidates and reprices; the returned draft replaces
 * local state. There is deliberately no optimistic tree edit — the price must
 * never show a number the server did not calculate.
 */
export function JourneyEditor({ draft, cityForPicker }: { draft: DraftView; cityForPicker: string | null }) {
  const t = useTranslations('customize');
  const autosave = useDraftAutosave(draft.id);
  const [picker, setPicker] = useState<PickerState>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard reordering: space lifts, arrows move, space drops.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dayKeys = useMemo(() => draft.days.map((day) => day.dayKey), [draft.days]);

  const availabilityByItem = useMemo(() => {
    const map = new Map<string, NonNullable<DraftView['availability']>['items'][number]>();
    for (const item of draft.availability?.items ?? []) {
      if (item.itemKey) {
        map.set(item.itemKey, item);
      }
    }
    return map;
  }, [draft.availability]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const from = dayKeys.indexOf(String(active.id));
    const to = dayKeys.indexOf(String(over.id));
    if (from === -1 || to === -1) {
      return;
    }
    const next = [...dayKeys];
    next.splice(to, 0, ...next.splice(from, 1));
    autosave.enqueue({ op: 'reorder_days', dayKeys: next }, { immediate: true });
  }

  function moveDay(dayKey: string, direction: -1 | 1) {
    const index = dayKeys.indexOf(dayKey);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= dayKeys.length) {
      return;
    }
    const next = [...dayKeys];
    [next[index], next[target]] = [next[target], next[index]];
    autosave.enqueue({ op: 'reorder_days', dayKeys: next }, { immediate: true });
  }

  function removeDay(dayKey: string, dayNumber: number, itemCount: number) {
    if (itemCount > 0) {
      const confirmed = window.confirm(
        t('removeDayConfirm', { number: dayNumber, count: itemCount }),
      );
      if (!confirmed) {
        return;
      }
    }
    autosave.enqueue({ op: 'remove_day', dayKey, confirmRemoval: true }, { immediate: true });
  }

  function onPickerSelect(item: DraftItemInput) {
    if (!picker) {
      return;
    }
    if (picker.mode === 'add') {
      autosave.enqueue({ op: 'add_item', dayKey: picker.dayKey, item }, { immediate: true });
    } else {
      autosave.enqueue({ op: 'replace_item', itemKey: picker.itemKey, item }, { immediate: true });
    }
    setPicker(null);
  }

  const saveError =
    autosave.error instanceof ApiError
      ? t('saveError', { message: autosave.error.message })
      : autosave.error
        ? t('saveError', { message: '' })
        : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <input
          value={draft.title}
          aria-label={t('title')}
          onChange={(event) => autosave.enqueue({ op: 'set_title', title: event.target.value })}
          className="w-full max-w-2xl rounded border border-transparent bg-transparent px-1 text-2xl font-semibold text-ink-900 hover:border-ink-200 focus:border-ink-300"
        />
        <p className="max-w-2xl text-sm text-ink-600">{t('subtitle')}</p>
      </header>

      {saveError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4">
          <p className="text-xs text-ink-500">{t('dragHint')}</p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={dayKeys} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-4">
                {draft.days.map((day) => (
                  <DayCard
                    key={day.dayKey}
                    day={day}
                    dayCount={draft.days.length}
                    availabilityByItem={availabilityByItem}
                    onMoveDay={(direction) => moveDay(day.dayKey, direction)}
                    onRemoveDay={() => removeDay(day.dayKey, day.dayNumber, day.items.length)}
                    onRenameDay={(title) =>
                      autosave.enqueue({ op: 'update_day', dayKey: day.dayKey, title })
                    }
                    onRemoveItem={(item: DraftItem) =>
                      autosave.enqueue({ op: 'remove_item', itemKey: item.itemKey }, { immediate: true })
                    }
                    onSwapItem={(item: DraftItem) =>
                      setPicker({ mode: 'swap', type: item.type, itemKey: item.itemKey })
                    }
                    onAddItem={(type) => setPicker({ mode: 'add', type, dayKey: day.dayKey })}
                    onUseAlternative={(item, alternative) =>
                      autosave.enqueue(
                        {
                          op: 'replace_item',
                          itemKey: item.itemKey,
                          item: { type: item.type, refId: alternative.refId, title: alternative.label },
                        },
                        { immediate: true },
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          <Button
            variant="secondary"
            onClick={() => autosave.enqueue({ op: 'add_day' }, { immediate: true })}
            className="self-start"
          >
            {t('addDay')}
          </Button>
        </section>

        <JourneyPricePanel
          draft={draft}
          isSaving={autosave.isSaving}
          pendingCount={autosave.pendingCount}
          onGuestsChange={(guests) => autosave.enqueue({ op: 'set_guests', guests })}
          onStartDateChange={(startDate) =>
            autosave.enqueue({ op: 'set_start_date', startDate }, { immediate: true })
          }
        />
      </div>

      {picker ? (
        <ResourcePicker
          type={picker.type}
          city={cityForPicker}
          onSelect={onPickerSelect}
          onCancel={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
