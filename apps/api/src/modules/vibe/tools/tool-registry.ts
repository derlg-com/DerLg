import { Injectable, Logger } from '@nestjs/common';
import { ItemType } from '@prisma/client';

import { AvailabilityService } from '../../availability/availability.service';
import { CatalogService } from '../../catalog/catalog.service';
import { ListPackagesQueryDto, PackageSort } from '../../catalog/dto/list-packages.query.dto';
import {
  ListGuidesQueryDto,
  ListHotelsQueryDto,
  ListPlacesQueryDto,
  ListTransportsQueryDto,
} from '../../catalog/dto/list-resources.query.dto';
import { ToolDefinition } from '../../llm/interfaces/llm.interface';
import { ShownItem } from '../interfaces/vibe.interface';
import {
  CheckAvailabilityArgsDto,
  ListPackagesArgsDto,
  SearchGuidesArgsDto,
  SearchHotelsArgsDto,
  SearchPlacesArgsDto,
  SearchTransportArgsDto,
} from './dto/tool-args.dto';

/** Everything a handler is allowed to know about who is asking. */
export interface ToolContext {
  userId: string;
  conversationId: string;
  /**
   * Catalogue ids a tool has actually returned in this conversation.
   *
   * The composer checks against this rather than only against the database,
   * because existence is not grounding: a model that guesses a plausible uuid,
   * or reuses one from its training data, must still be refused. `undefined`
   * means the caller does not track provenance (direct API use and tests); the
   * agent always supplies it, so the conversational path is always strict.
   */
  knownRefIds?: Set<string>;
  /** Named rows already shown, so a model that cannot copy a uuid can name one. */
  shownItems?: ShownItem[];
  /** The plan this conversation is shaping, used when the model omits a draftId. */
  draftId?: string;
}

/** A registered tool: its schema for the model, plus the code that runs it. */
export interface RegisteredTool<TArgs = unknown> {
  definition: ToolDefinition;
  /** DTO class used to validate and coerce the model's arguments. */
  argsType: new () => object;
  handler: (args: TArgs, context: ToolContext) => Promise<unknown>;
}

/**
 * THE SECURITY BOUNDARY.
 *
 * The original design put the AI in a separate process that could only reach the
 * database through HTTP endpoints authenticated with a service key. Collapsing
 * the agent into this NestJS app removes that process boundary, so it is
 * replaced by this whitelist: the model can invoke *only* the tools registered
 * here, with arguments validated against a DTO, and every catalogue id it
 * supplies is checked against the database before anything is written.
 *
 * Consequences that must not be quietly undone:
 *   - No tool in this file writes to the database. Booking holds and drafts are
 *     added in Task 16 and go through the same services the manual flow uses.
 *   - No tool touches payments. Ever.
 *   - No tool accepts a raw SQL fragment, a table name or a price.
 */
@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly availability: AvailabilityService,
  ) {
    this.registerReadOnlyTools();
  }

  /** Registers a tool. Task 16 uses this to add the two write tools. */
  register<TArgs>(name: string, tool: RegisteredTool<TArgs>): void {
    if (this.tools.has(name)) {
      throw new Error(`Tool "${name}" is already registered`);
    }
    this.tools.set(name, tool as RegisteredTool);
    this.logger.log(`Registered AI tool: ${name}`);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** Schemas handed to the model. */
  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  private registerReadOnlyTools(): void {
    this.register<SearchPlacesArgsDto>('search_places', {
      argsType: SearchPlacesArgsDto,
      definition: {
        name: 'search_places',
        description:
          'Find real places to visit in Cambodia (temples, museums, markets, nature, landmarks, food). Returns ids that can be used to build an itinerary.',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City slug: siem-reap or phnom-penh' },
            category: {
              type: 'string',
              enum: ['TEMPLE', 'MUSEUM', 'MARKET', 'NATURE', 'LANDMARK', 'ENTERTAINMENT', 'FOOD'],
            },
            query: { type: 'string', description: 'Free text to match name or description' },
            limit: { type: 'integer', description: 'Maximum results, 1-20' },
          },
        },
      },
      handler: async (args) => {
        const query = Object.assign(new ListPlacesQueryDto(), {
          city: args.city,
          category: args.category,
          q: args.query,
          limit: args.limit ?? 8,
          page: 1,
        });
        const page = await this.catalog.listPlaces(query);
        return {
          total: page.meta.total,
          items: page.items.map((place) => ({
            // The id is what the model must quote back to build an itinerary.
            refId: place.id,
            type: ItemType.PLACE,
            name: place.name,
            city: place.city.name,
            category: place.category,
            entranceFeeUsd: place.entranceFeeCents / 100,
            visitMinutes: place.visitDurationMinutes,
          })),
        };
      },
    });

    this.register<SearchHotelsArgsDto>('search_hotels', {
      argsType: SearchHotelsArgsDto,
      definition: {
        name: 'search_hotels',
        description: 'Find real hotels in a Cambodian city, optionally under a nightly price.',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City slug: siem-reap or phnom-penh' },
            maxPricePerNightUsd: { type: 'integer' },
            minStars: { type: 'integer', description: '1-5' },
            limit: { type: 'integer', description: 'Maximum results, 1-20' },
          },
        },
      },
      handler: async (args) => {
        const query = Object.assign(new ListHotelsQueryDto(), {
          city: args.city,
          maxPrice: args.maxPricePerNightUsd,
          minStars: args.minStars,
          limit: args.limit ?? 6,
          page: 1,
        });
        const page = await this.catalog.listHotels(query);
        return {
          total: page.meta.total,
          items: page.items.map((hotel) => ({
            refId: hotel.id,
            type: ItemType.HOTEL,
            name: hotel.name,
            city: hotel.city.name,
            stars: hotel.starRating,
            pricePerNightUsd: hotel.pricePerNightCents / 100,
            amenities: hotel.amenities.slice(0, 5),
          })),
        };
      },
    });

    this.register<SearchTransportArgsDto>('search_transport', {
      argsType: SearchTransportArgsDto,
      definition: {
        name: 'search_transport',
        description:
          'Find real transport between Cambodian cities (bus, van, tuk-tuk, private car), or day hire within a city.',
        parameters: {
          type: 'object',
          properties: {
            fromCity: { type: 'string', description: 'Origin city slug' },
            toCity: { type: 'string', description: 'Destination city slug' },
            kind: { type: 'string', enum: ['VAN', 'BUS', 'TUKTUK', 'PRIVATE_CAR'] },
            maxPricePerSeatUsd: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
      },
      handler: async (args) => {
        const query = Object.assign(new ListTransportsQueryDto(), {
          from: args.fromCity,
          to: args.toCity,
          kind: args.kind,
          maxPrice: args.maxPricePerSeatUsd,
          limit: args.limit ?? 6,
          page: 1,
        });
        const page = await this.catalog.listTransports(query);
        return {
          total: page.meta.total,
          items: page.items.map((transport) => ({
            refId: transport.id,
            type: ItemType.TRANSPORT,
            operator: transport.operator,
            kind: transport.kind,
            from: transport.originCity.name,
            to: transport.destinationCity.name,
            departureTime: transport.departureTime,
            durationMinutes: transport.durationMinutes,
            pricePerSeatUsd: transport.pricePerSeatCents / 100,
          })),
        };
      },
    });

    this.register<SearchGuidesArgsDto>('search_guides', {
      argsType: SearchGuidesArgsDto,
      definition: {
        name: 'search_guides',
        description:
          'Find real licensed tour guides, optionally filtered by city and spoken language (English, Khmer, Mandarin, French).',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City slug' },
            language: { type: 'string', description: 'Language name, e.g. Mandarin' },
            maxPricePerDayUsd: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
      },
      handler: async (args) => {
        const query = Object.assign(new ListGuidesQueryDto(), {
          city: args.city,
          language: args.language,
          maxPrice: args.maxPricePerDayUsd,
          limit: args.limit ?? 6,
          page: 1,
        });
        const page = await this.catalog.listGuides(query);
        return {
          total: page.meta.total,
          items: page.items.map((guide) => ({
            refId: guide.id,
            type: ItemType.GUIDE,
            name: guide.fullName,
            city: guide.city.name,
            languages: guide.languages,
            pricePerDayUsd: guide.pricePerDayCents / 100,
            rating: guide.rating,
            yearsExperience: guide.yearsExperience,
          })),
        };
      },
    });

    this.register<ListPackagesArgsDto>('list_packages', {
      argsType: ListPackagesArgsDto,
      definition: {
        name: 'list_packages',
        description:
          'List existing curated DerLg packages the traveller could book as-is or use as a starting point.',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City slug' },
            maxDays: { type: 'integer' },
            maxTotalUsd: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
      },
      handler: async (args) => {
        const query = Object.assign(new ListPackagesQueryDto(), {
          city: args.city,
          maxDays: args.maxDays,
          maxPrice: args.maxTotalUsd,
          limit: args.limit ?? 4,
          page: 1,
          sort: PackageSort.Featured,
        });
        const page = await this.catalog.listPackages(query);
        return {
          total: page.meta.total,
          items: page.items.map((pkg) => ({
            packageId: pkg.id,
            slug: pkg.slug,
            title: pkg.title,
            city: pkg.city.name,
            days: pkg.durationDays,
            kind: pkg.kind,
            priceUsd: pkg.basePriceCents / 100,
            pricingMode: pkg.pricingMode,
            kidFriendly: pkg.kidFriendly,
            summary: pkg.summary,
          })),
        };
      },
    });

    this.register<CheckAvailabilityArgsDto>('check_availability', {
      argsType: CheckAvailabilityArgsDto,
      definition: {
        name: 'check_availability',
        description:
          'Check whether specific places, hotels, transport or guides are available on the traveller´s dates, and what they would cost. Use the refIds returned by the search tools.',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'First day of the trip, YYYY-MM-DD' },
            guests: { type: 'integer', description: 'Number of travellers' },
            items: {
              type: 'array',
              description: 'The things to check, one entry per itinerary line.',
              items: {
                type: 'object',
                properties: {
                  dayNumber: { type: 'integer', description: '1 for the first day' },
                  type: { type: 'string', enum: ['PLACE', 'HOTEL', 'TRANSPORT', 'GUIDE'] },
                  refId: { type: 'string', description: 'Id from a search tool' },
                  title: { type: 'string' },
                },
                required: ['dayNumber', 'type', 'refId'],
              },
            },
          },
          required: ['startDate', 'guests', 'items'],
        },
      },
      handler: async (args) => {
        const result = await this.availability.check({
          startDate: args.startDate,
          guests: args.guests,
          items: args.items.map((item) => ({
            dayNumber: item.dayNumber,
            type: item.type,
            refId: item.refId,
            title: item.title ?? item.type,
            bookable: true,
          })),
        });

        return {
          available: result.availability.available,
          startDate: result.availability.startDate,
          endDate: result.availability.endDate,
          totalUsd: result.price.totalCents / 100,
          items: result.availability.items.map((item) => ({
            dayNumber: item.dayNumber,
            date: item.date,
            type: item.type,
            refId: item.refId,
            available: item.available,
            reason: item.reason,
            remaining: item.remaining,
            alternatives: item.alternatives.map((alternative) => ({
              refId: alternative.refId,
              name: alternative.label,
              priceUsd: alternative.priceCents / 100,
            })),
          })),
        };
      },
    });
  }
}
