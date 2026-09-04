import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { HotelType } from '@prisma/client';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListHotelsDto extends ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating?: number;

  @IsOptional()
  @IsEnum(HotelType)
  type?: HotelType;
}
