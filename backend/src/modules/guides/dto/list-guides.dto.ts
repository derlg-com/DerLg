import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupportedLanguage } from '@prisma/client';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListGuidesDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(SupportedLanguage)
  language?: SupportedLanguage;

  @IsOptional()
  @IsString()
  speciality?: string;
}
