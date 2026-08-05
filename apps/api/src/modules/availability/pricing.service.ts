import { HttpStatus, Injectable } from '@nestjs/common';
import { ItemType, PricingMode } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { CatalogRefResolver, ResolvedRefs } from '../catalog/catalog-ref.resolver';
import {
  PriceLine,
  PriceQuote,
  PriceableItem,
  unitsFor,
} from './interfaces/availability.interface';

export interface PackagePricingBasis {
  id: string;
  pricingMode: PricingMode;
  basePriceCents: number;
  minGroupSize: number;
  maxGroupSize: number;
}

export interface PriceInput {
  guests: number;
  items: PriceableItem[];
  /** The package a customised journey started from, if any. */
  basis?: PackagePricingBasis | null;
  /** The package template's original items, for the customisation delta. */
  templateItems?: PriceableItem[];
}

/**
 * The single pricing authority.
 *
 * A package's `basePriceCents` is the quoted price for the template as sold, so
 * item costs are NOT added on top of it — that would double-count. Instead the
 * total is `base + (cost of the current items - cost of the template items)`,
 * which makes "you added a night, that's +$54" fall out naturally and keeps a
 * from-scratch journey (no base) working with the same code.
 */
@Injectable()
export class PricingService {
  constructor(private readonly refs: CatalogRefResolver) {}

  /** Rejects party sizes the package cannot accept. */
  assertGroupSize(basis: PackagePricingBasis, guests: number): void {
    if (guests < basis.minGroupSize || guests > basis.maxGroupSize) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        `This trip takes ${basis.minGroupSize}–${basis.maxGroupSize} travellers.`,
        HttpStatus.BAD_REQUEST,
        { guests, minGroupSize: basis.minGroupSize, maxGroupSize: basis.maxGroupSize },
      );
    }
  }

  baseCentsFor(basis: PackagePricingBasis | null | undefined, guests: number): number {
    if (!basis) {
      return 0;
    }
    return basis.pricingMode === PricingMode.PER_PERSON
      ? basis.basePriceCents * guests
      : basis.basePriceCents;
  }

  /** Prices a set of items, returning both the total and the per-line detail. */
  lineItems(items: PriceableItem[], guests: number, resolved: ResolvedRefs): PriceLine[] {
    const lines: PriceLine[] = [];

    for (const item of items) {
      // Free-form / CUSTOM entries are never charged for (Task 16 invariant).
      if (!item.bookable || item.type === ItemType.CUSTOM) {
        continue;
      }

      const unitPriceCents =
        this.refs.unitPriceCents(item.type, item.refId, resolved) + (item.extraPriceCents ?? 0);
      const quantity = item.quantity ?? unitsFor(item.type, guests);

      if (quantity <= 0 || unitPriceCents <= 0) {
        continue;
      }

      lines.push({
        dayNumber: item.dayNumber,
        type: item.type,
        refId: item.refId,
        label: item.title,
        quantity,
        unitPriceCents,
        totalCents: unitPriceCents * quantity,
      });
    }

    return lines;
  }

  private sum(lines: PriceLine[]): number {
    return lines.reduce((total, line) => total + line.totalCents, 0);
  }

  /**
   * Full quote. `resolved` is passed in so a caller that already loaded the
   * catalogue rows (the availability check, the draft repricer) does not query twice.
   */
  quote(input: PriceInput, resolved: ResolvedRefs): PriceQuote {
    const { guests, items, basis, templateItems } = input;

    if (basis) {
      this.assertGroupSize(basis, guests);
    }

    const lines = this.lineItems(items, guests, resolved);
    const itemsCents = this.sum(lines);
    const templateItemsCents = templateItems
      ? this.sum(this.lineItems(templateItems, guests, resolved))
      : itemsCents;

    const baseCents = this.baseCentsFor(basis, guests);
    const deltaCents = itemsCents - templateItemsCents;

    // With a package basis the quoted base already covers the template, so only
    // the customisation delta is added. Without one (a from-scratch journey)
    // there is nothing to compare against and the items *are* the price.
    const totalCents = basis ? Math.max(0, baseCents + deltaCents) : itemsCents;

    return {
      guests,
      baseCents,
      itemsCents,
      templateItemsCents,
      deltaCents,
      totalCents,
      currency: 'USD',
      lines,
    };
  }

  /** Convenience wrapper that loads the referenced rows itself. */
  async quoteWithLookup(input: PriceInput): Promise<PriceQuote> {
    const refs = [...input.items, ...(input.templateItems ?? [])].map((item) => ({
      type: item.type,
      refId: item.refId,
    }));
    const resolved = await this.refs.resolve(refs);
    return this.quote(input, resolved);
  }
}
