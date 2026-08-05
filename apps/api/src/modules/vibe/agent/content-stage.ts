import { ItemType } from '@prisma/client';

import { VibeContentStage } from '../interfaces/vibe.interface';
import { ToolOutcome } from '../tools/tool-executor';

/**
 * Turns a tool result into the structured panel the right-hand screen renders.
 *
 * The model streams prose; this maps the *data* it looked up onto a Content
 * Stage so travellers see real cards with real prices rather than a wall of
 * text. Keeping it here — rather than asking the model to emit JSON — means a
 * card can never contain a price or an id the model invented.
 */

const STAGE_BY_TOOL: Record<string, VibeContentStage> = {
  search_places: 'places',
  search_hotels: 'hotels',
  search_transport: 'transport',
  search_guides: 'guides',
  list_packages: 'packages',
  check_availability: 'availability',
  compose_itinerary: 'itinerary',
  create_booking_hold: 'booking',
};

export function stageForTool(toolName: string): VibeContentStage | null {
  return STAGE_BY_TOOL[toolName] ?? null;
}

/** A short sentence describing a call in progress, for the tool_status event. */
export function labelForCall(toolName: string, rawArguments: string): string {
  const args = safeParse(rawArguments);
  const city = typeof args.city === 'string' ? prettifyCity(args.city) : undefined;

  switch (toolName) {
    case 'search_places':
      return city ? `Looking for places to visit in ${city}…` : 'Looking for places to visit…';
    case 'search_hotels':
      return city ? `Checking hotels in ${city}…` : 'Checking hotels…';
    case 'search_transport':
      return 'Checking how to get around…';
    case 'search_guides':
      return typeof args.language === 'string'
        ? `Finding a ${args.language}-speaking guide…`
        : 'Finding a guide…';
    case 'list_packages':
      return 'Looking through our trips…';
    case 'check_availability':
      return 'Checking availability and prices…';
    case 'compose_itinerary':
      return 'Putting your itinerary together…';
    case 'create_booking_hold':
      return 'Holding your booking…';
    default:
      return 'Working on it…';
  }
}

/** Picks the panel to show for a finished turn, if any tool produced one. */
export function contentForOutcomes(
  outcomes: ToolOutcome[],
): { stage: VibeContentStage; payload: unknown } | null {
  // Later stages win: an itinerary or a hold is more interesting than the search
  // that led to it.
  const ranked = [...outcomes]
    .filter((outcome) => outcome.success && stageForTool(outcome.name))
    .sort((a, b) => stageRank(a.name) - stageRank(b.name));

  const chosen = ranked.at(-1);
  if (!chosen) {
    return null;
  }

  const stage = stageForTool(chosen.name);
  if (!stage) {
    return null;
  }

  return { stage, payload: chosen.data };
}

const STAGE_ORDER = [
  'list_packages',
  'search_places',
  'search_hotels',
  'search_transport',
  'search_guides',
  'check_availability',
  'compose_itinerary',
  'create_booking_hold',
];

function stageRank(toolName: string): number {
  const index = STAGE_ORDER.indexOf(toolName);
  return index === -1 ? -1 : index;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function prettifyCity(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** How many shown items are recalled on later turns. */
const DIGEST_LIMIT = 8;

/**
 * Renders what was already shown into a line the model can read on later turns.
 *
 * Tool results cannot be replayed as `role:'tool'` messages — their call ids are
 * gone once the turn ends, and an orphaned tool message is rejected by the
 * provider. Without this digest the model forgets the actual items and prices it
 * put on screen, so a follow-up like "book the cheaper one" or "which is
 * biggest" sends it searching again instead of answering. Carrying the refIds
 * forward also means it can act on an earlier choice without re-verifying it.
 */
export function digestForShownContent(stage: VibeContentStage, payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (stage === 'availability') {
    const total = typeof record.totalUsd === 'number' ? `$${record.totalUsd}` : 'unknown';
    return `[Already shown: availability check — available: ${String(record.available)}, total ${total}]`;
  }

  if (stage === 'itinerary' || stage === 'booking') {
    return `[Already shown: ${stage} — ${JSON.stringify(record).slice(0, 400)}]`;
  }

  const items = Array.isArray(record.items) ? record.items : null;
  if (!items || items.length === 0) {
    return null;
  }

  const described = items.slice(0, DIGEST_LIMIT).map((entry) => {
    const item = entry as Record<string, unknown>;
    const name = item.name ?? item.operator ?? item.title ?? 'unnamed';
    const id = item.refId ?? item.packageId ?? item.slug;
    const price =
      item.pricePerNightUsd ??
      item.pricePerDayUsd ??
      item.pricePerSeatUsd ??
      item.entranceFeeUsd ??
      item.priceUsd;
    const priceText = typeof price === 'number' ? `, $${price}` : '';
    return `${String(name)} (refId ${String(id)}${priceText})`;
  });

  const more = items.length > DIGEST_LIMIT ? ` and ${items.length - DIGEST_LIMIT} more` : '';
  return `[Already shown to the traveller — ${stage}: ${described.join('; ')}${more}. Reuse these refIds instead of searching again.]`;
}

/** Item types the composer may place in a day, for prompt text. */
export const BOOKABLE_ITEM_TYPES: ItemType[] = [
  ItemType.PLACE,
  ItemType.HOTEL,
  ItemType.TRANSPORT,
  ItemType.GUIDE,
];
