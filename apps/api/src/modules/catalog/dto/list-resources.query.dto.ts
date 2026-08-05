import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListPlacesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(['TEMPLE', 'MUSEUM', 'MARKET', 'NATURE', 'LANDMARK', 'ENTERTAINMENT', 'FOOD'])
  category?: 'TEMPLE' | 'MUSEUM' | 'MARKET' | 'NATURE' | 'LANDMARK' | 'ENTERTAINMENT' | 'FOOD';

  @IsOptional()
  @IsString()
  q?: string;
}

export class ListHotelsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minStars?: number;

  @IsOptional()
  @IsString()
  q?: string;
}

export class ListTransportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsEnum(['VAN', 'BUS', 'TUKTUK', 'PRIVATE_CAR'])
  kind?: 'VAN' | 'BUS' | 'TUKTUK' | 'PRIVATE_CAR';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;
}

export class ListGuidesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  /** Language name as stored, e.g. `Mandarin`. Matched case-insensitively. */
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;
}
