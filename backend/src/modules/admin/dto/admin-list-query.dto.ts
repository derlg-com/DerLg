import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Pagination and free-text search shared by every admin list endpoint.
 *
 * Extend this rather than redeclaring `page`/`limit`/`search`. Two reasons it is
 * worth a base class:
 *
 *  1. **`forbidNonWhitelisted` is on.** An undeclared query param 400s the whole
 *     request, so "just read `@Query('page')`" is not enough once any DTO is
 *     introduced on a route — every accepted param has to be declared.
 *  2. **Enum params must be validated, not cast.** Several services did
 *     `where.status = status as SomeEnum` on a raw string, which turns a typo in
 *     the URL into a Prisma error and a 500. Validating at the boundary returns a
 *     400 that names the offending field instead.
 *
 * `limit` is capped at 100 per the project's pagination rule.
 */
export class AdminListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Adds an inclusive ISO date window. Both bounds are optional. */
export class AdminDateRangeQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}
