import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export enum TripCategoryFilter {
  temples = 'temples',
  nature = 'nature',
  culture = 'culture',
  adventure = 'adventure',
  food = 'food',
}

export class ListTripsDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(TripCategoryFilter)
  category?: TripCategoryFilter;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays?: number;
}
