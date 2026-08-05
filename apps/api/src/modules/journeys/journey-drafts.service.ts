import { ForbiddenException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DraftSource, ItemType, Prisma } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AvailabilityService } from '../availability/availability.service';
import { PriceableItem, toDateOnly } from '../availability/interfaces/availability.interface';
import { PricingService } from '../availability/pricing.service';
import { CatalogRefResolver, ResolvedRefs } from '../catalog/catalog-ref.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJourneyDraftDto, PatchJourneyDraftDto } from './dto/journey-draft.dto';
import {
  DraftDay,
  DraftItem,
  DraftSnapshot,
  DraftView,
} from './interfaces/journey-draft.interface';
import { applyOperations, newDayKey, newItemKey, renumberDays } from './journey-draft.mutations';

const DRAFT_SELECT = {
  id: true,
  userId: true,
  packageId: true,
  source: true,
  title: true,
  startDate: true,
  guests: true,
  snapshot: true,
  totalCents: true,
  baseTotalCents: true,
  createdAt: true,
  updatedAt: true,
  package: { select: { slug: true } },
} satisfies Prisma.JourneyDraftSelect;

type DraftRecord = Prisma.JourneyDraftGetPayload<{ select: typeof DRAFT_SELECT }>;

@Injectable()
export class JourneyDraftsService {
  private readonly logger = new Logger(JourneyDraftsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: CatalogRefResolver,
    private readonly pricing: PricingService,
    private readonly availability: AvailabilityService,
  ) {}

  /** Creates a draft from a package template, or blank when none is given. */
  async create(userId: string, dto: CreateJourneyDraftDto): Promise<DraftView> {
    const template = await this.loadTemplate(dto);
    const guests = dto.guests ?? template?.defaultGuests ?? 2;

    const snapshot: DraftSnapshot = template
      ? template.snapshot
      : {
          days: [
            { dayKey: newDayKey(), dayNumber: 1, title: 'Day 1', summary: '', items: [] },
          ],
          templateItems: [],
        };

    const title = dto.title ?? template?.title ?? 'My Cambodia journey';
    const priced = await this.priceSnapshot(snapshot, guests, template?.packageId ?? null);

    const created = await this.prisma.journeyDraft.create({
      data: {
        userId,
        packageId: template?.packageId ?? null,
        source: DraftSource.MANUAL,
        title,
        startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : null,
        guests,
        snapshot: priced.snapshot as unknown as Prisma.InputJsonValue,
        totalCents: priced.quote.totalCents,
        baseTotalCents: priced.quote.baseCents,
      },
      select: DRAFT_SELECT,
    });

    this.logger.log('Journey draft created', {
      draftId: created.id,
      userId,
      packageId: created.packageId,
    });

    return this.toView(created, dto.startDate ?? null);
  }

  /**
   * Creates a draft on behalf of the AI composer (Task 16). The snapshot has
   * already been built and verified by the caller; `source` records provenance.
   */
  async createFromSnapshot(input: {
    userId: string;
    packageId: string | null;
    title: string;
    guests: number;
    startDate: string | null;
    snapshot: DraftSnapshot;
    source: DraftSource;
  }): Promise<DraftView> {
    const priced = await this.priceSnapshot(input.snapshot, input.guests, input.packageId);

    const created = await this.prisma.journeyDraft.create({
      data: {
        userId: input.userId,
        packageId: input.packageId,
        source: input.source,
        title: input.title,
        startDate: input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null,
        guests: input.guests,
        snapshot: priced.snapshot as unknown as Prisma.InputJsonValue,
        totalCents: priced.quote.totalCents,
        baseTotalCents: priced.quote.baseCents,
      },
      select: DRAFT_SELECT,
    });

    return this.toView(created, input.startDate);
  }

  async findOne(userId: string, draftId: string): Promise<DraftView> {
    const draft = await this.loadOwned(userId, draftId);
    return this.toView(draft, draft.startDate ? toDateOnly(draft.startDate) : null);
  }

  async findAll(userId: string): Promise<DraftView[]> {
    const drafts = await this.prisma.journeyDraft.findMany({
      where: { userId },
      select: DRAFT_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return Promise.all(
      drafts.map((draft) => this.toView(draft, draft.startDate ? toDateOnly(draft.startDate) : null)),
    );
  }

  /** Applies a batch of operations, then revalidates and reprices server-side. */
  async patch(userId: string, draftId: string, dto: PatchJourneyDraftDto): Promise<DraftView> {
    const draft = await this.loadOwned(userId, draftId);
    const snapshot = draft.snapshot as unknown as DraftSnapshot;

    const { snapshot: mutated, context } = applyOperations(
      snapshot,
      {
        guests: draft.guests,
        startDate: draft.startDate ? toDateOnly(draft.startDate) : null,
        title: draft.title,
      },
      dto.operations,
    );

    // Every bookable reference is verified against the database before it is
    // persisted, so neither a stale client nor the AI can save an invented id.
    await this.assertReferencesExist(mutated);

    const priced = await this.priceSnapshot(mutated, context.guests, draft.packageId);

    const updated = await this.prisma.journeyDraft.update({
      where: { id: draft.id },
      data: {
        title: context.title,
        guests: context.guests,
        startDate: context.startDate ? new Date(`${context.startDate}T00:00:00.000Z`) : null,
        snapshot: priced.snapshot as unknown as Prisma.InputJsonValue,
        totalCents: priced.quote.totalCents,
        baseTotalCents: priced.quote.baseCents,
      },
      select: DRAFT_SELECT,
    });

    this.logger.log('Journey draft updated', {
      draftId: draft.id,
      userId,
      operations: dto.operations.map((operation) => operation.op),
      totalCents: updated.totalCents,
    });

    return this.toView(updated, context.startDate);
  }

  async remove(userId: string, draftId: string): Promise<null> {
    const draft = await this.loadOwned(userId, draftId);
    await this.prisma.journeyDraft.delete({ where: { id: draft.id } });
    return null;
  }

  /** Flattens a snapshot into the priceable/checkable item list. */
  static toPriceableItems(snapshot: DraftSnapshot): Array<PriceableItem & { itemKey: string }> {
    return snapshot.days.flatMap((day) =>
      day.items.map((item) => ({
        itemKey: item.itemKey,
        dayNumber: day.dayNumber,
        type: item.type,
        refId: item.refId,
        title: item.title,
        bookable: item.bookable,
        extraPriceCents: item.extraPriceCents,
      })),
    );
  }

  private async loadOwned(userId: string, draftId: string): Promise<DraftRecord> {
    const draft = await this.prisma.journeyDraft.findUnique({
      where: { id: draftId },
      select: DRAFT_SELECT,
    });

    if (!draft) {
      throw new NotFoundException('That journey draft does not exist.');
    }
    if (draft.userId !== userId) {
      // Deliberately a 403 rather than a 404: the id is a uuid, so leaking
      // existence tells an attacker nothing they could not already guess.
      throw new ForbiddenException('That journey draft belongs to someone else.');
    }

    return draft;
  }

  private async loadTemplate(dto: CreateJourneyDraftDto): Promise<{
    packageId: string;
    title: string;
    defaultGuests: number;
    snapshot: DraftSnapshot;
  } | null> {
    if (!dto.packageId && !dto.packageSlug) {
      return null;
    }

    const pkg = await this.prisma.package.findFirst({
      where: dto.packageId ? { id: dto.packageId } : { slug: dto.packageSlug },
      select: {
        id: true,
        title: true,
        minGroupSize: true,
        days: {
          orderBy: { dayNumber: 'asc' },
          select: {
            dayNumber: true,
            title: true,
            summary: true,
            items: {
              orderBy: { position: 'asc' },
              select: {
                type: true,
                refId: true,
                title: true,
                description: true,
                startTime: true,
                durationMinutes: true,
                priceCents: true,
                bookable: true,
              },
            },
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException('That package does not exist.');
    }

    const days: DraftDay[] = pkg.days.map((day) => ({
      dayKey: newDayKey(),
      dayNumber: day.dayNumber,
      title: day.title,
      summary: day.summary,
      items: day.items.map(
        (item): DraftItem => ({
          itemKey: newItemKey(),
          type: item.type,
          refId: item.refId,
          title: item.title,
          description: item.description,
          startTime: item.startTime,
          durationMinutes: item.durationMinutes,
          extraPriceCents: item.priceCents,
          bookable: item.bookable,
          unitPriceCents: 0,
          referenceLabel: null,
        }),
      ),
    }));

    return {
      packageId: pkg.id,
      title: pkg.title,
      defaultGuests: Math.max(pkg.minGroupSize, 2),
      snapshot: {
        days: renumberDays(days),
        // Frozen copy of the template, so the delta stays stable no matter how
        // much the traveller edits afterwards.
        templateItems: pkg.days.flatMap((day) =>
          day.items.map((item) => ({
            dayNumber: day.dayNumber,
            type: item.type,
            refId: item.refId,
            title: item.title,
            bookable: item.bookable,
            extraPriceCents: item.priceCents,
          })),
        ),
      },
    };
  }

  /** Rejects the whole patch when any bookable reference cannot be resolved. */
  private async assertReferencesExist(snapshot: DraftSnapshot): Promise<void> {
    const refs = JourneyDraftsService.toPriceableItems(snapshot)
      .filter((item) => item.bookable && item.type !== ItemType.CUSTOM)
      .map((item) => ({ type: item.type, refId: item.refId }));

    const missing = await this.refs.findMissing(refs);
    if (missing.length > 0) {
      throw new AppException(
        ErrorCode.CATALOG_UNKNOWN_REFERENCE,
        'Part of this journey refers to something that no longer exists.',
        HttpStatus.BAD_REQUEST,
        { missing },
      );
    }
  }

  /**
   * Reprices a snapshot and refreshes the denormalised display fields
   * (`unitPriceCents`, `referenceLabel`) from the live catalogue.
   */
  private async priceSnapshot(
    snapshot: DraftSnapshot,
    guests: number,
    packageId: string | null,
  ) {
    const items = JourneyDraftsService.toPriceableItems(snapshot);
    const resolved = await this.refs.resolve([
      ...items.map((item) => ({ type: item.type, refId: item.refId })),
      ...snapshot.templateItems.map((item) => ({ type: item.type, refId: item.refId })),
    ]);

    const basis = await this.availability.pricingBasisFor(packageId);
    const quote = this.pricing.quote(
      { guests, items, basis, templateItems: snapshot.templateItems.map((item) => ({ ...item })) },
      resolved,
    );

    const hydrated: DraftSnapshot = {
      templateItems: snapshot.templateItems,
      days: snapshot.days.map((day) => ({
        ...day,
        items: day.items.map((item) => ({
          ...item,
          unitPriceCents:
            item.bookable && item.type !== ItemType.CUSTOM
              ? this.refs.unitPriceCents(item.type, item.refId, resolved) + item.extraPriceCents
              : 0,
          referenceLabel: this.labelFor(item, resolved),
        })),
      })),
    };

    return { snapshot: hydrated, quote };
  }

  private labelFor(item: DraftItem, resolved: ResolvedRefs): string | null {
    if (!item.refId) {
      return null;
    }
    switch (item.type) {
      case ItemType.PLACE:
        return resolved.places.get(item.refId)?.name ?? null;
      case ItemType.HOTEL:
        return resolved.hotels.get(item.refId)?.name ?? null;
      case ItemType.TRANSPORT: {
        const transport = resolved.transports.get(item.refId);
        return transport ? `${transport.operator} ${transport.departureTime}` : null;
      }
      case ItemType.GUIDE:
        return resolved.guides.get(item.refId)?.fullName ?? null;
      default:
        return null;
    }
  }

  /** Builds the API representation, including a live availability check when dated. */
  private async toView(draft: DraftRecord, startDate: string | null): Promise<DraftView> {
    const snapshot = draft.snapshot as unknown as DraftSnapshot;
    const items = JourneyDraftsService.toPriceableItems(snapshot);

    const resolved = await this.refs.resolve([
      ...items.map((item) => ({ type: item.type, refId: item.refId })),
      ...snapshot.templateItems.map((item) => ({ type: item.type, refId: item.refId })),
    ]);
    const basis = await this.availability.pricingBasisFor(draft.packageId);
    const quote = this.pricing.quote(
      {
        guests: draft.guests,
        items,
        basis,
        templateItems: snapshot.templateItems.map((item) => ({ ...item })),
      },
      resolved,
    );

    const view: DraftView = {
      id: draft.id,
      title: draft.title,
      source: draft.source,
      packageId: draft.packageId,
      packageSlug: draft.package?.slug ?? null,
      startDate,
      guests: draft.guests,
      days: snapshot.days,
      price: {
        baseCents: quote.baseCents,
        itemsCents: quote.itemsCents,
        templateItemsCents: quote.templateItemsCents,
        deltaCents: quote.deltaCents,
        totalCents: quote.totalCents,
        currency: quote.currency,
        lines: quote.lines,
      },
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };

    if (startDate && items.length > 0) {
      const report = await this.availability.check({
        startDate,
        guests: draft.guests,
        packageId: draft.packageId ?? undefined,
        items: items.map((item) => ({
          dayNumber: item.dayNumber,
          type: item.type,
          refId: item.refId ?? undefined,
          title: item.title,
          bookable: item.bookable,
          extraPriceCents: item.extraPriceCents,
          itemKey: item.itemKey,
        })),
      });

      view.availability = {
        available: report.availability.available,
        unavailableCount: report.availability.unavailableCount,
        items: report.availability.items.map((item) => ({
          itemKey: item.itemKey,
          dayNumber: item.dayNumber,
          date: item.date,
          available: item.available,
          reason: item.reason,
          remaining: item.remaining,
          alternatives: item.alternatives.map((alternative) => ({
            refId: alternative.refId,
            slug: alternative.slug,
            label: alternative.label,
            priceCents: alternative.priceCents,
          })),
        })),
      };
    }

    return view;
  }
}
