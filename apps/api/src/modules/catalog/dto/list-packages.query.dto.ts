import { Type } from 'class-transformer';
import { IsBooleanString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum PackageSort {
  Featured = 'featured',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  DurationAsc = 'duration_asc',
  Newest = 'newest',
}

export class ListPackagesQueryDto extends PaginationQueryDto {
  /** City slug, e.g. `siem-reap`. */
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(['PUBLIC', 'PRIVATE'], { message: 'kind must be PUBLIC or PRIVATE' })
  kind?: 'PUBLIC' | 'PRIVATE';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDays?: number;

  /** Inclusive price bounds in whole USD dollars (converted to cents server-side). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsBooleanString({ message: 'kidFriendly must be true or false' })
  kidFriendly?: string;

  @IsOptional()
  @IsBooleanString({ message: 'featured must be true or false' })
  featured?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(PackageSort)
  sort: PackageSort = PackageSort.Featured;
}
