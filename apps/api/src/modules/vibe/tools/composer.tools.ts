import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DraftSource, ItemType } from '@prisma/client';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { BookingsService } from '../../bookings/bookings.service';
import { CatalogRefResolver } from '../../catalog/catalog-ref.resolver';
import { CatalogService } from '../../catalog/catalog.service';
import { DraftDay, DraftItem, DraftSnapshot } from '../../journeys/interfaces/journey-draft.interface';
import { newDayKey, newItemKey } from '../../journeys/journey-draft.mutations';
import { JourneyDraftsService } from '../../journeys/journey-drafts.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ComposeDayArgsDto,
  ComposeDayTitleArgsDto,
  ComposeFlatItemArgsDto,
  ComposeItemArgsDto,
  ComposeItineraryArgsDto,
  CreateBookingHoldArgsDto,
  ReadDraftArgsDto,
} from './dto/composer-args.dto';
import { ShownItem } from '../interfaces/vibe.interface';
import { ToolContext, ToolRegistry } from './tool-registry';

/**
 * The two tools that write.
 *
 * These are registered separately from the read-only six to keep the boundary
 * legible: everything that can change state in a traveller's account lives in
 * this file, and both of these delegate to the exact services the manual UI
 * uses. That is deliberate — the AI must not be able to produce a plan, a price
 * or a hold that a person clicking buttons could not.
 *
 *   compose_itinerary  -> JourneyDraftsService (which prices via Task 8)
 *   create_booking_hold -> BookingsService (which takes the same row locks)
 *
 * Neither tool touches payment. Money is only ever moved by the traveller, from
 * the checkout page, through Stripe.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ComposerTools implements OnModuleInit {
  private readonly logger = new Logger(ComposerTools.name);

  constructor(
    private readonly registry: ToolRegistry,
    private readonly drafts: JourneyDraftsService,
    private readonly bookings: BookingsService,
    private readonly catalog: CatalogService,
    private readonly refs: CatalogRefResolver,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.registry.register<ComposeItineraryArgsDto>('compose_itinerary', {
      argsType: ComposeItineraryArgsDto,
      definition: {
        name: 'compose_itinerary',
        description:
          'Build a trip from real places, hotels, transport and guides, price it, and save it as an editable plan. Give one flat list of items, each tagged with the day it belongs to. Use the refIds returned by the search tools. Returns a draftId needed to hold a booking. Use type CUSTOM for free time or your own suggestions that are not bookable.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short name for the trip, a few words' },
            startDate: { type: 'string', description: 'First day, YYYY-MM-DD' },
            guests: { type: 'integer', description: 'Number of travellers' },
            packageSlug: {
              type: 'string',
              description: 'Optional: the package this plan is based on',
            },
            items: {
              type: 'array',
              description:
                'Everything in the trip as one flat list. Repeat dayNumber for several items on the same day.',
              items: {
                type: 'object',
                properties: {
                  dayNumber: { type: 'integer', description: '1 for the first day' },
                  type: {
                    type: 'string',
                    enum: ['PLACE', 'HOTEL', 'TRANSPORT', 'GUIDE', 'CUSTOM'],
                  },
                  refId: {
                    type: 'string',
                    description: 'The exact id from a search tool. Omit only for CUSTOM.',
                  },
                  title: { type: 'string' },
                  startTime: { type: 'string', description: 'e.g. 09:30' },
                },
                required: ['dayNumber', 'type', 'title'],
              },
            },
            dayTitles: {
              type: 'array',
              description: 'Optional heading for each day, in your own words.',
              items: {
                type: 'object',
                properties: {
                  dayNumber: { type: 'integer' },
                  title: { type: 'string' },
                  summary: { type: 'string' },
                },
                required: ['dayNumber', 'title'],
              },
            },
          },
          required: ['title', 'startDate', 'guests', 'items'],
        },
      },
      handler: (args, context) => this.composeItinerary(args, context),
    });

    this.registry.register<ReadDraftArgsDto>('get_journey_draft', {
      argsType: ReadDraftArgsDto,
      definition: {
        name: 'get_journey_draft',
        description:
          'Read a plan the traveller already has, so you can discuss or change it. Omit draftId to read the plan this conversation is working on. Use this when they arrive from the trip editor or refer to "my trip".',
        parameters: {
          type: 'object',
          properties: {
            draftId: {
              type: 'string',
              description: 'Omit to read the plan already open in this conversation.',
            },
          },
        },
      },
      handler: (args, context) => this.readDraft(args, context),
    });

    this.registry.register<CreateBookingHoldArgsDto>('create_booking_hold', {
      argsType: CreateBookingHoldArgsDto,
      definition: {
        name: 'create_booking_hold',
        description:
          'Reserve everything in a saved plan for 15 minutes so the traveller can pay. Requires the draftId from compose_itinerary. This does NOT charge anything — the traveller pays on the checkout page.',
        parameters: {
          type: 'object',
          properties: {
            draftId: {
              type: 'string',
              description:
                'The draftId from compose_itinerary. Omit it to hold the plan you just built.',
            },
          },
        },
      },
      handler: (args, context) => this.createBookingHold(args, context),
    });
  }

  private async composeItinerary(
    args: ComposeItineraryArgsDto,
    context: ToolContext,
  ): Promise<unknown> {
    const basis = args.packageSlug
      ? await this.catalog.getPackageBySlug(args.packageSlug).catch(() => null)
      : null;

    if (args.packageSlug && !basis) {
      throw new AppException(
        ErrorCode.CATALOG_UNKNOWN_REFERENCE,
        `There is no package with the slug "${args.packageSlug}". Call list_packages to see the real ones, or leave packageSlug out.`,
        400,
      );
    }

    const snapshot = this.toSnapshot(args);

    // A model that cannot reproduce a 36-character uuid will write something
    // else in its place — observed sending the tool's own name. Rather than
    // failing outright, resolve against what it was actually shown. This does
    // not weaken grounding: the only ids obtainable this way are ones a tool
    // already returned in this conversation.
    const unresolved: string[] = [];
    for (const day of snapshot.days) {
      for (const item of day.items) {
        if (!item.bookable || !item.refId) {
          continue;
        }
        if (context.knownRefIds?.has(item.refId)) {
          continue;
        }
        const matched = matchShownItem(item, context.shownItems ?? []);
        if (matched) {
          this.logger.log(
            `Resolved "${item.refId}" to ${matched.name} (${matched.refId}) by name`,
            { conversationId: context.conversationId },
          );
          item.refId = matched.refId;
          item.referenceLabel = matched.name;
        } else if (context.knownRefIds) {
          unresolved.push(`${item.title} (sent refId "${item.refId}")`);
        }
      }
    }

    if (unresolved.length > 0) {
      throw new AppException(
        ErrorCode.CATALOG_UNKNOWN_REFERENCE,
        `These are not things you have looked up: ${unresolved.join('; ')}. Use the exact refId values listed under "Things you have already found", or search again first.`,
        400,
      );
    }

    const bookableRefs = snapshot.days.flatMap((day) =>
      day.items
        .filter((item) => item.bookable && item.refId)
        .map((item) => ({ type: item.type, refId: item.refId as string })),
    );

    if (bookableRefs.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'A plan needs at least one real place, hotel, transport or guide. Search for some first, then compose the itinerary with the refIds you were given.',
        400,
      );
    }

    // Anything still not shaped like a catalogue id must not reach Prisma — a
    // malformed uuid raises a driver error rather than a clean refusal.
    const malformed = bookableRefs.filter((ref) => !UUID_PATTERN.test(ref.refId));
    if (malformed.length > 0) {
      throw new AppException(
        ErrorCode.CATALOG_UNKNOWN_REFERENCE,
        `These are not real ids: ${malformed.map((ref) => `"${ref.refId}"`).join(', ')}. Use the exact refId a search tool returned.`,
        400,
      );
    }

    // The anti-hallucination guard. Every bookable id is checked against the
    // catalogue before a row is written, and the model is told exactly which
    // ones were wrong so it can search again rather than guess.
    const missing = await this.refs.findMissing(bookableRefs);

    if (missing.length > 0) {
      throw new AppException(
        ErrorCode.CATALOG_UNKNOWN_REFERENCE,
        `These ids are not in our catalogue: ${missing.map((ref) => ref.refId).join(', ')}. Search again and use only the refIds a tool returned.`,
        400,
      );
    }

    const draft = await this.drafts.createFromSnapshot({
      userId: context.userId,
      packageId: basis?.id ?? null,
      title: args.title,
      guests: args.guests,
      startDate: args.startDate,
      snapshot,
      source: DraftSource.AI,
    });

    this.logger.log(
      `Composed AI draft ${draft.id} (${draft.days.length} days, $${(draft.price.totalCents / 100).toFixed(2)})`,
      { conversationId: context.conversationId },
    );

    return {
      draftId: draft.id,
      title: draft.title,
      startDate: draft.startDate,
      guests: draft.guests,
      totalUsd: draft.price.totalCents / 100,
      currency: draft.price.currency,
      days: draft.days.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        summary: day.summary,
        items: day.items.map((item) => ({
          type: item.type,
          refId: item.refId,
          title: item.title,
          startTime: item.startTime,
          bookable: item.bookable,
          name: item.referenceLabel,
          unitPriceUsd: item.unitPriceCents / 100,
        })),
      })),
      priceLines: draft.price.lines.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        totalUsd: line.totalCents / 100,
      })),
      availability: draft.availability
        ? {
            available: draft.availability.available,
            unavailable: draft.availability.items
              .filter((item) => !item.available)
              .map((item) => ({
                dayNumber: item.dayNumber,
                date: item.date,
                reason: item.reason,
                alternatives: item.alternatives.map((alternative) => ({
                  refId: alternative.refId,
                  name: alternative.label,
                  priceUsd: alternative.priceCents / 100,
                })),
              })),
          }
        : null,
    };
  }

  /**
   * Reads a plan the traveller already has.
   *
   * This is the manual -> AI direction of the handoff: someone who built a trip
   * in the editor and clicked through to the concierge arrives with a draft, and
   * without this the model would have no idea what is in it and would start
   * again from nothing. Read-only, and ownership is checked by the service.
   */
  private async readDraft(args: ReadDraftArgsDto, context: ToolContext): Promise<unknown> {
    const draftId = args.draftId?.trim() || context.draftId;
    if (!draftId) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'There is no plan open in this conversation yet. Ask the traveller what they would like to do, or build one with compose_itinerary.',
        400,
      );
    }

    const draft = await this.drafts.findOne(context.userId, draftId);

    return {
      draftId: draft.id,
      title: draft.title,
      startDate: draft.startDate,
      guests: draft.guests,
      source: draft.source,
      packageSlug: draft.packageSlug,
      totalUsd: draft.price.totalCents / 100,
      days: draft.days.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        items: day.items.map((item) => ({
          type: item.type,
          // Given back so the model can reuse them without searching again.
          refId: item.refId,
          name: item.referenceLabel ?? item.title,
          startTime: item.startTime,
          bookable: item.bookable,
          unitPriceUsd: item.unitPriceCents / 100,
        })),
      })),
      availability: draft.availability
        ? { available: draft.availability.available }
        : null,
    };
  }

  private async createBookingHold(
    args: CreateBookingHoldArgsDto,
    context: ToolContext,
  ): Promise<unknown> {
    // Contact details come from the account, not the conversation, so the model
    // cannot address a confirmation to someone else.
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw new AppException(ErrorCode.NOT_FOUND, 'That account no longer exists', 404);
    }

    const draftId = args.draftId?.trim() || context.draftId;
    if (!draftId) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'There is no saved plan to hold yet. Call compose_itinerary first.',
        400,
      );
    }

    // Contact details always come from the account. The model has no say.
    const booking = await this.bookings.create(
      context.userId,
      { name: user.fullName, email: user.email },
      {
        draftId,
        contactName: user.fullName,
        contactEmail: user.email,
      },
    );

    this.logger.log(`AI created hold ${booking.reference} for draft ${draftId}`, {
      conversationId: context.conversationId,
    });

    return {
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      totalUsd: booking.totalCents / 100,
      holdExpiresAt: booking.holdExpiresAt,
      secondsRemaining: booking.secondsRemaining,
      // No URL: given one, the model wrapped it in an invented domain and put
      // that in the chat. The UI builds the checkout link from bookingId.
      guests: booking.guests,
      startDate: booking.startDate,
    };
  }

  /** Maps the model's plan onto the draft snapshot the rest of the app uses. */
  private toSnapshot(args: ComposeItineraryArgsDto): DraftSnapshot {
    const grouped = args.items?.length
      ? this.groupFlatItems(args.items, args.dayTitles ?? [])
      : (args.days ?? []);

    const days: DraftDay[] = [...grouped]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((day, index) => ({
        dayKey: newDayKey(),
        // Renumbered so a model that skips or repeats a number still produces a
        // contiguous trip.
        dayNumber: index + 1,
        title: day.title,
        summary: day.summary ?? '',
        items: day.items.map((item) => this.toDraftItem(item)),
      }));

    return {
      days,
      // An AI plan has no template to compare against: every item is a choice,
      // so the customisation delta starts at zero.
      templateItems: days.flatMap((day) =>
        day.items.map((item) => ({
          dayNumber: day.dayNumber,
          type: item.type,
          refId: item.refId,
          title: item.title,
          bookable: item.bookable,
          extraPriceCents: item.extraPriceCents,
        })),
      ),
    };
  }

  /** Turns the flat list the model produces back into days. */
  private groupFlatItems(
    items: ComposeFlatItemArgsDto[],
    dayTitles: ComposeDayTitleArgsDto[],
  ): ComposeDayArgsDto[] {
    const titles = new Map(dayTitles.map((day) => [day.dayNumber, day]));
    const byDay = new Map<number, ComposeDayArgsDto>();

    for (const item of items) {
      let day = byDay.get(item.dayNumber);
      if (!day) {
        const heading = titles.get(item.dayNumber);
        day = {
          dayNumber: item.dayNumber,
          title: heading?.title ?? `Day ${item.dayNumber}`,
          summary: heading?.summary,
          items: [],
        };
        byDay.set(item.dayNumber, day);
      }
      day.items.push(item);
    }

    return [...byDay.values()];
  }

  private toDraftItem(item: ComposeItemArgsDto): DraftItem {
    const isCustom = item.type === 'CUSTOM';

    return {
      itemKey: newItemKey(),
      type: item.type as ItemType,
      // The invariant from Task 3: a CUSTOM item is never bookable, never
      // priced, and never carries a catalogue reference. This is how the AI is
      // allowed to invent "an afternoon by the river" without inventing a hotel.
      refId: isCustom ? null : (item.refId ?? null),
      title: item.title,
      description: item.description ?? '',
      startTime: item.startTime ?? null,
      durationMinutes: item.durationMinutes ?? 0,
      extraPriceCents: 0,
      bookable: !isCustom,
      unitPriceCents: 0,
      referenceLabel: null,
    };
  }
}

/**
 * Finds the row the model meant, by title or by a near-miss on the id.
 *
 * Matching is deliberately narrow: only rows already returned by a tool in this
 * conversation are candidates, and the item's own type must agree. So the worst
 * a confused model can achieve is picking the wrong real hotel, never inventing
 * one.
 */
function matchShownItem(
  item: { type: string; title: string; refId: string | null },
  shown: ShownItem[],
): ShownItem | null {
  const sameType = shown.filter((candidate) => candidate.type === item.type);
  if (sameType.length === 0) {
    return null;
  }

  const normalise = (value: string): string => value.trim().toLowerCase();
  const title = normalise(item.title);
  const sent = item.refId ? normalise(item.refId) : '';

  const exact = sameType.find(
    (candidate) => normalise(candidate.name) === title || normalise(candidate.name) === sent,
  );
  if (exact) {
    return exact;
  }

  // "Angkor Wat at sunrise" should still find "Angkor Wat".
  const partial = sameType.filter((candidate) => {
    const name = normalise(candidate.name);
    return title.includes(name) || name.includes(title);
  });

  return partial.length === 1 ? partial[0] : null;
}
