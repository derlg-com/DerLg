import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateJourneyDraftDto {
  /** Start from a package template; omit for a blank journey. */
  @IsOptional()
  @IsUUID()
  packageId?: string;

  /** Convenience alternative to packageId when the client only has a slug. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  packageSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  guests?: number;
}

/** Item payload for add/replace operations. */
export class DraftItemInputDto {
  @IsEnum(['PLACE', 'HOTEL', 'TRANSPORT', 'GUIDE', 'CUSTOM'])
  type!: 'PLACE' | 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'CUSTOM';

  @IsOptional()
  @IsUUID()
  refId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  startTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  extraPriceCents?: number;
}

/**
 * Mutations are expressed as explicit named operations rather than a whole-tree
 * PUT. That keeps intent legible in logs, lets the server validate each change
 * on its own terms, and avoids two editors silently clobbering each other's tree.
 */
export class DraftOperationDto {
  @IsEnum([
    'reorder_days',
    'add_day',
    'remove_day',
    'update_day',
    'add_item',
    'remove_item',
    'replace_item',
    'move_item',
    'set_guests',
    'set_start_date',
    'set_title',
  ])
  op!:
    | 'reorder_days'
    | 'add_day'
    | 'remove_day'
    | 'update_day'
    | 'add_item'
    | 'remove_item'
    | 'replace_item'
    | 'move_item'
    | 'set_guests'
    | 'set_start_date'
    | 'set_title';

  /** reorder_days: the complete list of dayKeys in their new order. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dayKeys?: string[];

  /** Target day for add_day (insert position), remove_day, update_day, add_item. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  dayKey?: string;

  /** Target item for remove_item, replace_item, move_item. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  itemKey?: string;

  /** move_item: the day the item is moving to. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  toDayKey?: string;

  /** move_item / add_item: index within the target day. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DraftItemInputDto)
  item?: DraftItemInputDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  guests?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  confirmRemoval?: boolean;
}

export class PatchJourneyDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftOperationDto)
  operations!: DraftOperationDto[];
}
