import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * Arguments for the two tools that write.
 *
 * As with the read tools, every numeric field coerces because the model sends
 * numbers as JSON strings. The important difference is that these DTOs are the
 * outer edge of a write path, so the constraints are tighter: a refId must be a
 * uuid, and a CUSTOM item may not carry one at all.
 */

export class ComposeItemArgsDto {
  @IsEnum(['PLACE', 'HOTEL', 'TRANSPORT', 'GUIDE', 'CUSTOM'])
  type!: 'PLACE' | 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'CUSTOM';

  /**
   * Required for anything bookable, forbidden for CUSTOM. This is where an
   * invented hotel is caught before it can reach the database.
   */
  @ValidateIf((item: ComposeItemArgsDto) => item.type !== 'CUSTOM')
  @IsString({ message: 'refId must be an id returned by a search tool' })
  @MaxLength(200)
  refId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must look like 09:30' })
  startTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_440)
  durationMinutes?: number;
}

export class ComposeDayArgsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dayNumber!: number;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  summary?: string;

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ComposeItemArgsDto)
  items!: ComposeItemArgsDto[];
}

/** A day heading, supplied alongside the flat item list. */
export class ComposeDayTitleArgsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dayNumber!: number;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  summary?: string;
}

/** An item in the flat list, carrying the day it belongs to. */
export class ComposeFlatItemArgsDto extends ComposeItemArgsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dayNumber!: number;
}

export class ComposeItineraryArgsDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsDateString({}, { message: 'startDate must be a date like 2026-11-04' })
  startDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  guests!: number;

  /** Optional package the plan is based on, so its base price still applies. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  packageSlug?: string;

  /**
   * The itinerary as ONE flat list, each item tagged with its day.
   *
   * This is the shape the tool advertises to the model. Small models cannot
   * reliably emit two levels of nesting — llama-3.1-8b truncated a nested
   * `days` array on every attempt — but a flat list of small objects it manages.
   * It also matches how the journey editor already thinks about items.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => ComposeFlatItemArgsDto)
  items?: ComposeFlatItemArgsDto[];

  /** Optional headings for those days. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ComposeDayTitleArgsDto)
  dayTitles?: ComposeDayTitleArgsDto[];

  /** The nested form, still accepted for direct API callers. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ComposeDayArgsDto)
  days?: ComposeDayArgsDto[];
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateBookingHoldArgsDto {
  /**
   * Optional: the conversation's current plan is used when it is omitted.
   *
   * Small models routinely lose a uuid between turns, and refusing the hold at
   * that point strands a traveller who has already said yes. A conversation
   * shapes one plan at a time, so falling back to it is unambiguous.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    // The model sends a blank, a tool name, or a half-remembered id far more
    // often than it sends nothing at all. Anything not shaped like an id is
    // treated as absent so the conversation's own plan is used — which is still
    // ownership-checked, so this cannot reach someone else's draft.
    if (typeof value !== 'string' || !UUID_SHAPE.test(value.trim())) {
      return undefined;
    }
    return value.trim();
  })
  @IsUUID(undefined, { message: 'draftId must be the id returned by compose_itinerary' })
  draftId?: string;

  /*
   * There is deliberately NO contact name or email here.
   *
   * An earlier version accepted them as optional overrides, and the model
   * promptly invented "Traveller <traveller@example.com>" — so a real booking
   * carried a contact address belonging to nobody. Who a booking belongs to is
   * not something a language model gets to decide; it comes from the
   * authenticated account.
   */
}

/** Reading a plan the traveller already has. */
export class ReadDraftArgsDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && UUID_SHAPE.test(value.trim()) ? value.trim() : undefined,
  )
  @IsUUID(undefined, { message: 'draftId must be a real plan id' })
  draftId?: string;
}
