import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupportedLanguage, Specialty } from '@prisma/client';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListGuidesDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(SupportedLanguage)
  language?: SupportedLanguage;

  @IsOptional()
  @IsEnum(Specialty)
  specialty?: Specialty;

  /** Filter guides that run this trip package (implicit m2m, P2). */
  @IsOptional()
  @IsString()
  tripId?: string;
}
