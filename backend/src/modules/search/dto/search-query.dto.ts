import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum SearchType {
  trip = 'trip',
  place = 'place',
  hotel = 'hotel',
  guide = 'guide',
  all = 'all',
}

export class SearchQueryDto extends PaginationDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  q!: string;

  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType;
}
