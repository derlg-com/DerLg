import { randomUUID } from 'node:crypto';

import { HttpStatus } from '@nestjs/common';
import { ItemType } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { DraftDay, DraftItem, DraftSnapshot } from './interfaces/journey-draft.interface';

import type { DraftOperationDto } from './dto/journey-draft.dto';

/**
 * Pure snapshot transformations. Keeping these free of Prisma and Nest makes the
 * day/item algebra exhaustively unit-testable, which matters because this is the
 * code a traveller's saved plan passes through on every keystroke of the editor.
 */

const MAX_DAYS = 30;
const MAX_ITEMS_PER_DAY = 12;

function fail(message: string, details?: Record<string, unknown>): never {
  throw new AppException(
    ErrorCode.DRAFT_INVALID_MUTATION,
    message,
    HttpStatus.BAD_REQUEST,
    details,
  );
}

export function newItemKey(): string {
  return `it_${randomUUID().slice(0, 8)}`;
}

export function newDayKey(): string {
  return `dy_${randomUUID().slice(0, 8)}`;
}

/** Days always carry contiguous 1..n numbering after any structural change. */
export function renumberDays(days: DraftDay[]): DraftDay[] {
  return days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
}

function findDay(snapshot: DraftSnapshot, dayKey: string | undefined): DraftDay {
  if (!dayKey) {
    fail('This change needs a target day.');
  }
  const day = snapshot.days.find((candidate) => candidate.dayKey === dayKey);
  if (!day) {
    fail(`Day "${dayKey}" is not part of this journey.`, { dayKey });
  }
  return day;
}

function locateItem(snapshot: DraftSnapshot, itemKey: string | undefined): {
  day: DraftDay;
  index: number;
} {
  if (!itemKey) {
    fail('This change needs a target item.');
  }
  for (const day of snapshot.days) {
    const index = day.items.findIndex((item) => item.itemKey === itemKey);
    if (index !== -1) {
      return { day, index };
    }
  }
  return fail(`Item "${itemKey}" is not part of this journey.`, { itemKey });
}

/** Minutes since midnight, or null for an unscheduled item. */
function minutesOf(startTime: string | null): number | null {
  if (!startTime) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Rejects a day whose scheduled *visits* overlap.
 *
 * Only PLACE and CUSTOM entries occupy an exclusive slot. HOTEL, TRANSPORT and
 * GUIDE are day-spanning resources — a hotel covers the night, a hired tuk-tuk
 * or a guide covers the whole day and is expected to run alongside the visits it
 * exists to serve. Treating them as exclusive made every seeded package with a
 * day-long vehicle unmodifiable.
 */
const SLOT_OCCUPYING_TYPES = new Set<ItemType>([ItemType.PLACE, ItemType.CUSTOM]);

export function assertNoTimeConflicts(day: DraftDay): void {
  const scheduled = day.items
    .filter((item) => SLOT_OCCUPYING_TYPES.has(item.type) && minutesOf(item.startTime) !== null)
    .map((item) => ({
      item,
      start: minutesOf(item.startTime)!,
      end: minutesOf(item.startTime)! + Math.max(0, item.durationMinutes),
    }))
    .sort((a, b) => a.start - b.start);

  for (let index = 1; index < scheduled.length; index += 1) {
    const previous = scheduled[index - 1];
    const current = scheduled[index];
    if (current.start < previous.end) {
      fail(
        `"${current.item.title}" overlaps "${previous.item.title}" on day ${day.dayNumber}.`,
        {
          dayNumber: day.dayNumber,
          conflicting: [previous.item.itemKey, current.item.itemKey],
        },
      );
    }
  }
}

export function itemFromInput(input: {
  type: string;
  refId?: string | null;
  title: string;
  description?: string;
  startTime?: string | null;
  durationMinutes?: number;
  extraPriceCents?: number;
}): DraftItem {
  const type = input.type as ItemType;
  const isCustom = type === ItemType.CUSTOM;

  if (!isCustom && !input.refId) {
    fail(`A ${type.toLowerCase()} must reference a real catalogue entry.`, { type });
  }

  return {
    itemKey: newItemKey(),
    type,
    // CUSTOM entries never carry a reference, even if one was sent.
    refId: isCustom ? null : (input.refId ?? null),
    title: input.title,
    description: input.description ?? '',
    startTime: input.startTime ?? null,
    durationMinutes: input.durationMinutes ?? 60,
    extraPriceCents: isCustom ? 0 : (input.extraPriceCents ?? 0),
    // Free-form items are never bookable and never priced (Task 16 invariant).
    bookable: !isCustom,
    unitPriceCents: 0,
    referenceLabel: null,
  };
}

export interface MutationContext {
  guests: number;
  startDate: string | null;
  title: string;
}

export interface MutationResult {
  snapshot: DraftSnapshot;
  context: MutationContext;
}

/** Applies one operation, returning new objects rather than mutating in place. */
export function applyOperation(
  snapshot: DraftSnapshot,
  context: MutationContext,
  operation: DraftOperationDto,
): MutationResult {
  const next: DraftSnapshot = {
    templateItems: snapshot.templateItems,
    days: snapshot.days.map((day) => ({ ...day, items: [...day.items] })),
  };
  const nextContext = { ...context };

  switch (operation.op) {
    case 'reorder_days': {
      const keys = operation.dayKeys ?? [];
      if (keys.length !== next.days.length || new Set(keys).size !== keys.length) {
        fail('A reorder must list every day exactly once.', {
          expected: next.days.length,
          received: keys.length,
        });
      }
      const byKey = new Map(next.days.map((day) => [day.dayKey, day]));
      const reordered = keys.map((key) => {
        const day = byKey.get(key);
        if (!day) {
          fail(`Day "${key}" is not part of this journey.`, { dayKey: key });
        }
        return day;
      });
      next.days = renumberDays(reordered);
      break;
    }

    case 'add_day': {
      if (next.days.length >= MAX_DAYS) {
        fail(`A journey can span at most ${MAX_DAYS} days.`);
      }
      const day: DraftDay = {
        dayKey: newDayKey(),
        dayNumber: next.days.length + 1,
        title: operation.title ?? `Day ${next.days.length + 1}`,
        summary: operation.summary ?? '',
        items: [],
      };
      const at = operation.position ?? next.days.length;
      next.days.splice(Math.min(Math.max(at, 0), next.days.length), 0, day);
      next.days = renumberDays(next.days);
      break;
    }

    case 'remove_day': {
      const day = findDay(next, operation.dayKey);
      if (next.days.length === 1) {
        fail('A journey needs at least one day.');
      }
      if (day.items.length > 0 && !operation.confirmRemoval) {
        fail('Confirm removal to delete a day that still has activities.', {
          dayKey: day.dayKey,
          itemCount: day.items.length,
        });
      }
      next.days = renumberDays(next.days.filter((candidate) => candidate.dayKey !== day.dayKey));
      break;
    }

    case 'update_day': {
      const day = findDay(next, operation.dayKey);
      const index = next.days.indexOf(day);
      next.days[index] = {
        ...day,
        title: operation.title ?? day.title,
        summary: operation.summary ?? day.summary,
      };
      break;
    }

    case 'add_item': {
      const day = findDay(next, operation.dayKey);
      if (!operation.item) {
        fail('An item payload is required to add an activity.');
      }
      if (day.items.length >= MAX_ITEMS_PER_DAY) {
        fail(`A day can hold at most ${MAX_ITEMS_PER_DAY} activities.`, { dayKey: day.dayKey });
      }
      const item = itemFromInput(operation.item);
      const at = operation.position ?? day.items.length;
      day.items.splice(Math.min(Math.max(at, 0), day.items.length), 0, item);
      assertNoTimeConflicts(day);
      break;
    }

    case 'remove_item': {
      const { day, index } = locateItem(next, operation.itemKey);
      day.items.splice(index, 1);
      break;
    }

    case 'replace_item': {
      const { day, index } = locateItem(next, operation.itemKey);
      if (!operation.item) {
        fail('A replacement item payload is required.');
      }
      const existing = day.items[index];
      const replacement = itemFromInput(operation.item);
      day.items[index] = {
        ...replacement,
        // Keep the key so the editor's DOM node and any pending UI state survive.
        itemKey: existing.itemKey,
        startTime: operation.item.startTime ?? existing.startTime,
        durationMinutes: operation.item.durationMinutes ?? existing.durationMinutes,
      };
      assertNoTimeConflicts(day);
      break;
    }

    case 'move_item': {
      const { day: fromDay, index } = locateItem(next, operation.itemKey);
      const toDay = findDay(next, operation.toDayKey ?? fromDay.dayKey);
      if (toDay !== fromDay && toDay.items.length >= MAX_ITEMS_PER_DAY) {
        fail(`A day can hold at most ${MAX_ITEMS_PER_DAY} activities.`, { dayKey: toDay.dayKey });
      }
      const [item] = fromDay.items.splice(index, 1);
      const at = operation.position ?? toDay.items.length;
      toDay.items.splice(Math.min(Math.max(at, 0), toDay.items.length), 0, item);
      assertNoTimeConflicts(toDay);
      break;
    }

    case 'set_guests': {
      if (operation.guests === undefined) {
        fail('A traveller count is required.');
      }
      nextContext.guests = operation.guests;
      break;
    }

    case 'set_start_date': {
      nextContext.startDate = operation.startDate ?? null;
      break;
    }

    case 'set_title': {
      if (!operation.title) {
        fail('A title is required.');
      }
      nextContext.title = operation.title;
      break;
    }

    default:
      fail(`Unsupported operation.`);
  }

  return { snapshot: next, context: nextContext };
}

export function applyOperations(
  snapshot: DraftSnapshot,
  context: MutationContext,
  operations: DraftOperationDto[],
): MutationResult {
  return operations.reduce<MutationResult>(
    (accumulator, operation) =>
      applyOperation(accumulator.snapshot, accumulator.context, operation),
    { snapshot, context },
  );
}

export { MAX_DAYS, MAX_ITEMS_PER_DAY };
