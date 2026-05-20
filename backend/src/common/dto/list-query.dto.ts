import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';
import type { Lang } from '../i18n';

const SUPPORTED_LANGS: Lang[] = ['en', 'zh', 'km'];

/** Shared base DTO for all catalog list/search endpoints. */
export class ListQueryDto extends PaginationDto {
  /** Free-text search term (min 2 chars). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  q?: string;

  /** Preferred response language. Falls back to Accept-Language header, then 'en'. */
  @IsOptional()
  @IsIn(SUPPORTED_LANGS)
  lang?: Lang;

  /** Sort field (e.g. `price_asc`, `rating_desc`). Module-specific; ignored if unknown. */
  @IsOptional()
  @IsString()
  sort?: string;
}
