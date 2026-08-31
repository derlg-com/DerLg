import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SupportedLanguage } from '@prisma/client';

/**
 * Query params for `GET /v1/admin/ai-sessions`.
 *
 * Every field must be declared: the global ValidationPipe runs with
 * `forbidNonWhitelisted`, so an undeclared param makes the whole request 400
 * rather than being ignored.
 */
export class ListAiSessionsDto {
  /** Matches session title, guest handle, or the owner's email / full name. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(SupportedLanguage)
  language?: SupportedLanguage;

  /**
   * Restrict to anonymous conversations. A string because query params are
   * always strings; `onlyGuestsBool` does the conversion.
   */
  @IsOptional()
  @IsBooleanString()
  onlyGuests?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Capped at 100 to match the other admin list endpoints. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  get onlyGuestsBool(): boolean {
    return this.onlyGuests === 'true';
  }
}
